import { Controller, Get, Query } from '@nestjs/common';
import { Actor, CurrentActor, Permissions } from '../auth/access';
import { page, parse } from '../common/core';
import { PrismaService } from '../prisma.service';
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly db: PrismaService) {}
  @Get('seller/overview') @Permissions('seller:own') async overview(@CurrentActor() a: Actor) {
    const [products, orders, seller] = await Promise.all([
      this.db.product.groupBy({ by: ['status'], where: { sellerId: a.sellerId! }, _count: true }),
      this.db.orderItem.groupBy({
        by: ['status'],
        where: { sellerId: a.sellerId!, order: { paymentStatus: 'PAID' } },
        _count: true,
      }),
      this.db.seller.findUnique({
        where: { id: a.sellerId! },
        select: {
          storeName: true,
          status: true,
          rating: true,
          commissionRate: true,
          taxRate: true,
          rejectionReason: true,
        },
      }),
    ]);
    return { products, orders, seller };
  }
  @Get('seller/disputes') @Permissions('seller:own') disputes(
    @CurrentActor() a: Actor,
    @Query() q: unknown,
  ) {
    return this.db.dispute.findMany({
      where: { orderItem: { sellerId: a.sellerId! } },
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      include: { orderItem: true },
    });
  }
  @Get('seller/returns') @Permissions('seller:own') returns(
    @CurrentActor() a: Actor,
    @Query() q: unknown,
  ) {
    return this.db.returnRequest.findMany({
      where: { orderItem: { sellerId: a.sellerId! } },
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      include: { orderItem: true },
    });
  }
  @Get('seller/reviews') @Permissions('seller:own') reviews(
    @CurrentActor() a: Actor,
    @Query() q: unknown,
  ) {
    return this.db.review.findMany({
      where: { product: { sellerId: a.sellerId! }, deletedAt: null },
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { titleI18n: true } } },
    });
  }
  @Get('admin/sellers') @Permissions('sellers:rates') sellers(@Query() q: unknown) {
    return this.db.seller.findMany({ ...parse(page, q), orderBy: { createdAt: 'desc' } });
  }
  @Get('admin/promotions') @Permissions('promotions:platform:create') promotions() {
    return this.db.promotion.findMany({
      where: { scope: 'PLATFORM' },
      orderBy: { id: 'desc' },
      take: 1000,
    });
  }
  @Get('admin/content-sellers') @Permissions('sanctions:content') contentSellers(
    @Query() q: unknown,
  ) {
    return this.db.seller.findMany({
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      select: { id: true, storeName: true, status: true, rating: true, createdAt: true },
    });
  }
  @Get('admin/reviews') @Permissions('reviews:moderate') allReviews(@Query() q: unknown) {
    return this.db.review.findMany({
      where: { deletedAt: null },
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      include: { product: { select: { titleI18n: true } } },
    });
  }
  @Get('admin/categories') @Permissions('categories:manage') categories() {
    return this.db.category.findMany({ orderBy: { id: 'asc' } });
  }
  @Get('admin/staff') @Permissions('staff:manage') staff(@Query() q: unknown) {
    return this.db.staffAccount.findMany({
      ...parse(page, q),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });
  }
}
