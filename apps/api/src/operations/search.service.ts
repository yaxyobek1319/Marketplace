import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
@Injectable()
export class SearchService {
  constructor(private readonly db: PrismaService) {}
  async request(path: string, method = 'GET', data?: unknown): Promise<any> {
    const base = process.env.MEILISEARCH_URL,
      key = process.env.MEILISEARCH_MASTER_KEY;
    if (!base || !key) throw new ServiceUnavailableException('Qidiruv sozlanmagan');
    try {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
      return response.status === 204 ? null : await response.json();
    } catch {
      throw new ServiceUnavailableException('Qidiruv vaqtincha ishlamayapti');
    }
  }
  async awaitTask(task: { taskUid: number }) {
    for (let n = 0; n < 100; n++) {
      const r = await this.request(`/tasks/${task.taskUid}`);
      if (r.status === 'succeeded') return;
      if (r.status === 'failed' || r.status === 'canceled') throw new Error('Search task failed');
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Search task timeout');
  }
  async setup() {
    await this.awaitTask(
      await this.request('/indexes/products/settings', 'PATCH', {
        searchableAttributes: ['titleI18n.uz', 'titleI18n.ru'],
        filterableAttributes: ['categoryId', 'categoryPath', 'sellerId', 'price', 'inStock'],
        sortableAttributes: ['price', 'ratingAvg', 'sellerRating', 'createdAt'],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'sellerRating:desc',
          'exactness',
        ],
      }),
    );
  }
  async search(input: {
    q: string;
    categoryId?: number;
    sellerId?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    skip: number;
    take: number;
  }) {
    const filter: string[] = [];
    if (input.categoryId) filter.push(`categoryPath = ${input.categoryId}`);
    if (input.sellerId) filter.push(`sellerId = "${input.sellerId}"`);
    if (input.minPrice !== undefined) filter.push(`price >= ${input.minPrice}`);
    if (input.maxPrice !== undefined) filter.push(`price <= ${input.maxPrice}`);
    return this.request('/indexes/products/search', 'POST', {
      q: input.q,
      filter,
      sort: input.sort ? [input.sort] : undefined,
      offset: input.skip,
      limit: input.take,
    });
  }
  async product(productId: string) {
    const p = await this.db.product.findUnique({
      where: { id: productId },
      include: {
        seller: true,
        category: true,
        variants: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
        images: { orderBy: { sortOrder: 'asc' } },
        reviews: { where: { deletedAt: null }, select: { rating: true } },
      },
    });
    const variants = p?.variants ?? [];
    if (!p || p.status !== 'ACTIVE' || p.seller.status !== 'ACTIVE' || p.category.deletedAt) {
      if (variants.length)
        await this.awaitTask(
          await this.request(
            '/indexes/products/documents/delete-batch',
            'POST',
            variants.map((v) => v.id),
          ),
        );
      return;
    }
    const categoryPath: number[] = [];
    let category: typeof p.category | null = p.category;
    while (category && !categoryPath.includes(category.id)) {
      categoryPath.push(category.id);
      category = category.parentId
        ? await this.db.category.findUnique({ where: { id: category.parentId } })
        : null;
    }
    const inactive = variants.filter((v) => !v.isActive).map((v) => v.id);
    if (inactive.length)
      await this.awaitTask(
        await this.request('/indexes/products/documents/delete-batch', 'POST', inactive),
      );
    const documents = variants
      .filter((v) => v.isActive)
      .map((v) => ({
        variantId: v.id,
        productId: p.id,
        sellerId: p.sellerId,
        titleI18n: p.titleI18n,
        categoryId: p.categoryId,
        categoryPath,
        price: v.price.toNumber(),
        stockQuantity: v.stockQuantity,
        inStock: v.stockQuantity > 0,
        ratingAvg: p.reviews.length
          ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
          : 0,
        sellerRating: p.seller.rating.toNumber(),
        mainImageUrl: v.images[0]?.url ?? p.images[0]?.url ?? null,
        createdAt: p.createdAt.getTime(),
      }));
    if (documents.length)
      await this.awaitTask(
        await this.request('/indexes/products/documents?primaryKey=variantId', 'POST', documents),
      );
  }
  async seller(sellerId: string) {
    const items = await this.db.product.findMany({ where: { sellerId }, select: { id: true } });
    for (const p of items) await this.product(p.id);
  }
  async rebuild() {
    await this.setup();
    let cursor: string | undefined;
    do {
      const items = await this.db.product.findMany({
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      for (const p of items) await this.product(p.id);
      cursor = items.length === 100 ? items[items.length - 1].id : undefined;
    } while (cursor);
  }
}
