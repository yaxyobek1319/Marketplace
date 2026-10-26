import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import {
  audit,
  emit,
  ensure,
  imageUrl,
  localized,
  lock,
  positiveAmount,
  required,
  Tx,
} from '../common/core';
import { SellersService } from '../sellers/sellers.service';
export const variantInput = z
  .object({
    sku: z.string().trim().min(1).max(100),
    price: positiveAmount,
    stockQuantity: z.number().int().min(0).max(1000000),
    attributes: z.record(
      z.string().max(100),
      z.union([z.string().max(500), z.number(), z.boolean()]),
    ),
    images: z.array(imageUrl).max(20).default([]),
  })
  .strict();
export const productInput = z
  .object({
    categoryId: z.number().int().positive(),
    titleI18n: localized,
    description: z.string().max(20000).optional(),
    mxikCodeOverride: z
      .string()
      .regex(/^\d{17}$/)
      .optional(),
    images: z.array(imageUrl).max(20).default([]),
    variants: z.array(variantInput).min(1).max(200),
    attributes: z
      .array(
        z
          .object({
            key: z.string().min(1).max(100),
            value: z.union([localized, z.string().max(5000), z.number()]),
            type: z.enum(['TEXT', 'NUMBER', 'FILE']),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict();
@Injectable()
export class CatalogService {
  constructor(
    private readonly db: PrismaService,
    private readonly sellers: SellersService,
  ) {}
  async scan(tx: Tx, content: string) {
    const keywords = await tx.prohibitedKeyword.findMany();
    const normalized = content.normalize('NFKC').toLocaleLowerCase();
    const matches = keywords.filter((k) =>
      normalized.includes(k.term.normalize('NFKC').toLocaleLowerCase()),
    );
    return {
      result: matches.some((k) => k.severity === 'CRITICAL')
        ? ('BLOCKED' as const)
        : matches.length
          ? ('FLAGGED' as const)
          : ('CLEAN' as const),
      matches: matches.map((k) => k.id),
    };
  }
  async create(userId: string, data: z.infer<typeof productInput>) {
    return this.db.$transaction(async (tx) => {
      const seller = await this.sellers.own(tx, userId, true);
      await this.sellers.canPublish(tx, seller.id);
      required(await tx.category.findFirst({ where: { id: data.categoryId, deletedAt: null } }));
      ensure(
        new Set(data.variants.map((v) => v.sku)).size === data.variants.length,
        'SKU takrorlanmasin',
      );
      const { variants, images, attributes, ...fields } = data;
      const product = await tx.product.create({
        data: {
          ...fields,
          sellerId: seller.id,
          images: { create: images.map((url, sortOrder) => ({ url, sortOrder })) },
          attributes: { create: attributes },
        },
      });
      for (const v of variants) {
        const { images: urls, ...fields } = v;
        const variant = await tx.productVariant.create({
          data: { ...fields, productId: product.id },
        });
        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            changeAmount: v.stockQuantity,
            type: 'INITIAL',
            createdBy: userId,
          },
        });
        await tx.productImage.createMany({
          data: urls.map((url, sortOrder) => ({
            productId: product.id,
            variantId: variant.id,
            url,
            sortOrder,
          })),
        });
      }
      return product;
    });
  }
  async edit(
    userId: string,
    productId: string,
    data: {
      titleI18n?: { uz: string; ru: string };
      description?: string;
      mxikCodeOverride?: string;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const seller = await this.sellers.own(tx, userId, true);
      const old = required(
        await tx.product.findFirst({ where: { id: productId, sellerId: seller.id } }),
      );
      ensure(old.status !== 'SUSPENDED', 'Mahsulot moderator tomonidan to‘xtatilgan');
      const result = await tx.product.update({
        where: { id: productId },
        data: { ...data, status: 'DRAFT' },
      });
      await emit(tx, 'search.product', { productId }, 1);
      return result;
    });
  }
  async submit(userId: string, productId: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const seller = await this.sellers.own(tx, userId, true);
      const product = required(
        await tx.product.findFirst({
          where: { id: productId, sellerId: seller.id },
          include: { category: true, variants: true, attributes: true },
        }),
      );
      ensure(['DRAFT', 'REJECTED'].includes(product.status), 'Mahsulot yuborishga tayyor emas');
      ensure(
        !product.category.deletedAt && product.variants.some((v) => v.isActive),
        'Kategoriya yoki variatsiya mavjud emas',
      );
      await this.sellers.canPublish(tx, seller.id);
      const scan = await this.scan(
        tx,
        JSON.stringify([
          product.titleI18n,
          product.description,
          product.attributes,
          product.variants.map((v) => v.attributes),
        ]),
      );
      const status =
        product.category.riskLevel === 'HIGH' || scan.result === 'BLOCKED'
          ? 'PENDING_REVIEW'
          : 'ACTIVE';
      await tx.productScan.create({
        data: {
          productId,
          type: 'SUBMISSION_KEYWORD',
          result: scan.result,
          details: { matches: scan.matches },
        },
      });
      const result = await tx.product.update({
        where: { id: productId },
        data: {
          status,
          moderationRequired: status === 'PENDING_REVIEW' || scan.result !== 'CLEAN',
        },
      });
      await emit(tx, 'search.product', { productId });
      return result;
    });
  }
  async moderate(
    staffId: string,
    productId: string,
    status: 'ACTIVE' | 'REJECTED' | 'SUSPENDED',
    reason: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const old = required(await tx.product.findUnique({ where: { id: productId } }));
      ensure(old.status !== status, 'Holat allaqachon o‘zgargan');
      if (status === 'ACTIVE') {
        ensure(['PENDING_REVIEW', 'SUSPENDED'].includes(old.status), 'Moderatsiya navbatida emas');
        await this.sellers.canPublish(tx, old.sellerId);
      }
      const result = await tx.product.update({
        where: { id: productId },
        data: { status, moderationRequired: status === 'SUSPENDED' },
      });
      await audit(
        tx,
        staffId,
        status === 'ACTIVE' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
        'Product',
        productId,
        { from: old.status, to: status, reason },
      );
      await emit(tx, 'search.product', { productId }, 1);
      return result;
    });
  }
  async adjustStock(userId: string, variantId: string, changeAmount: number, reason: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
      const seller = await this.sellers.own(tx, userId, true);
      const variant = required(
        await tx.productVariant.findFirst({
          where: { id: variantId, product: { sellerId: seller.id } },
        }),
      );
      ensure(variant.stockQuantity + changeAmount >= 0, 'Zaxira manfiy bo‘la olmaydi');
      await tx.stockMovement.create({
        data: { variantId, changeAmount, reason, type: 'MANUAL_ADJUSTMENT', createdBy: userId },
      });
      const result = await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { increment: changeAmount } },
      });
      await emit(tx, 'search.product', { productId: variant.productId });
      return result;
    });
  }
  async variantEdit(
    userId: string,
    variantId: string,
    data: { price?: string; isActive?: boolean },
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE`;
      const seller = await this.sellers.own(tx, userId, true);
      const variant = required(
        await tx.productVariant.findFirst({
          where: { id: variantId, product: { sellerId: seller.id } },
        }),
      );
      const result = await tx.productVariant.update({ where: { id: variantId }, data });
      await emit(tx, 'search.product', { productId: variant.productId });
      return result;
    });
  }
  async category(
    staffId: string,
    categoryId: number | undefined,
    data: {
      nameI18n: { uz: string; ru: string };
      parentId?: number | null;
      riskLevel: 'LOW' | 'HIGH';
      mxikCode?: string;
      hidden?: boolean;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, 'category-tree');
      let current = data.parentId;
      const visited = new Set<number>();
      while (current) {
        ensure(current !== categoryId && !visited.has(current), 'Kategoriya daraxtida sikl');
        visited.add(current);
        current = required(await tx.category.findUnique({ where: { id: current } })).parentId;
      }
      const { hidden, ...fields } = data;
      const result = categoryId
        ? await tx.category.update({
            where: { id: categoryId },
            data: {
              ...fields,
              deletedAt: hidden === undefined ? undefined : hidden ? new Date() : null,
            },
          })
        : await tx.category.create({ data: fields });
      await audit(tx, staffId, 'CATEGORY_EDITED', 'Category', String(result.id), data);
      await emit(tx, 'search.rebuild', {});
      if (data.riskLevel === 'HIGH') await emit(tx, 'catalog.rescan', { categoryId: result.id });
      return result;
    });
  }
  async addVariant(userId: string, productId: string, data: z.infer<typeof variantInput>) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const seller = await this.sellers.own(tx, userId, true);
      const product = required(
        await tx.product.findFirst({ where: { id: productId, sellerId: seller.id } }),
      );
      ensure(product.status !== 'SUSPENDED', 'Mahsulot to‘xtatilgan');
      const { images, ...fields } = data;
      const v = await tx.productVariant.create({ data: { ...fields, productId } });
      await tx.stockMovement.create({
        data: {
          variantId: v.id,
          changeAmount: data.stockQuantity,
          type: 'INITIAL',
          createdBy: userId,
        },
      });
      await tx.productImage.createMany({
        data: images.map((url, sortOrder) => ({ productId, variantId: v.id, url, sortOrder })),
      });
      await tx.product.update({ where: { id: productId }, data: { status: 'DRAFT' } });
      await emit(tx, 'search.product', { productId }, 1);
      return v;
    });
  }
  async replaceMedia(
    userId: string,
    productId: string,
    images: { url: string; variantId?: string; sortOrder: number }[],
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const seller = await this.sellers.own(tx, userId, true);
      const product = required(
        await tx.product.findFirst({
          where: { id: productId, sellerId: seller.id },
          include: { variants: true },
        }),
      );
      ensure(product.status !== 'SUSPENDED', 'Mahsulot to‘xtatilgan');
      for (const image of images)
        ensure(
          !image.variantId || product.variants.some((v) => v.id === image.variantId),
          'Variatsiya boshqa mahsulotga tegishli',
        );
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.productImage.createMany({ data: images.map((image) => ({ ...image, productId })) });
      await tx.product.update({ where: { id: productId }, data: { status: 'DRAFT' } });
      await emit(tx, 'search.product', { productId }, 1);
      return { updated: true };
    });
  }
  async replaceAttributes(
    userId: string,
    productId: string,
    attributes: z.infer<typeof productInput>['attributes'],
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `product:${productId}`);
      const seller = await this.sellers.own(tx, userId, true);
      const product = required(
        await tx.product.findFirst({ where: { id: productId, sellerId: seller.id } }),
      );
      ensure(product.status !== 'SUSPENDED', 'Mahsulot to‘xtatilgan');
      await tx.productAttribute.deleteMany({ where: { productId } });
      await tx.productAttribute.createMany({
        data: attributes.map((attribute) => ({ ...attribute, productId })),
      });
      await tx.product.update({ where: { id: productId }, data: { status: 'DRAFT' } });
      await emit(tx, 'search.product', { productId }, 1);
      return { updated: true };
    });
  }
  async rescan(categoryId?: number, productId?: string) {
    const products = await this.db.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(categoryId ? { categoryId } : {}),
        ...(productId ? { id: productId } : {}),
      },
      select: { id: true },
    });
    for (const p of products)
      await this.db.$transaction(async (tx) => {
        await lock(tx, `product:${p.id}`);
        const product = required(
          await tx.product.findUnique({
            where: { id: p.id },
            include: { attributes: true, variants: true },
          }),
        );
        if (product.status !== 'ACTIVE') return;
        const scan = await this.scan(
          tx,
          JSON.stringify([
            product.titleI18n,
            product.description,
            product.attributes,
            product.variants.map((v) => v.attributes),
          ]),
        );
        await tx.productScan.create({
          data: {
            productId: p.id,
            type: productId ? 'USER_REPORT_TRIGGERED' : 'PERIODIC_RESCAN',
            result: scan.result,
            details: { matches: scan.matches },
          },
        });
        if (scan.result !== 'CLEAN') {
          await tx.product.update({
            where: { id: p.id },
            data: { status: 'SUSPENDED', moderationRequired: true },
          });
          await emit(tx, 'search.product', { productId: p.id }, 1);
        }
      });
  }
}
