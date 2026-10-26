import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DeliveryType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ensure, lock, money, required, Tx, zero } from '../common/core';
import { LedgerService } from './ledger.service';
import { allocate, bestPromotion } from './pricing';
@Injectable()
export class CartService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
  ) {}
  async set(userId: string, variantId: string, quantity: number, deliveryType: DeliveryType) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `buyer:${userId}`);
      const v = required(
        await tx.productVariant.findFirst({
          where: {
            id: variantId,
            isActive: true,
            product: {
              status: 'ACTIVE',
              seller: { status: 'ACTIVE' },
              category: { deletedAt: null },
            },
          },
        }),
      );
      ensure(v.stockQuantity >= quantity, 'Zaxira yetarli emas');
      const cart = await tx.cart.upsert({
        where: { buyerId: userId },
        create: { buyerId: userId },
        update: { updatedAt: new Date() },
      });
      return tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: { cartId: cart.id, variantId, quantity, deliveryType },
        update: { quantity, deliveryType },
      });
    });
  }
  async remove(userId: string, variantId: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `buyer:${userId}`);
      return tx.cartItem.deleteMany({ where: { cart: { buyerId: userId }, variantId } });
    });
  }
  async groupDelivery(userId: string, sellerId: string, deliveryType: DeliveryType) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `buyer:${userId}`);
      return tx.cartItem.updateMany({
        where: { cart: { buyerId: userId }, variant: { product: { sellerId } } },
        data: { deliveryType },
      });
    });
  }
  async quote(tx: Tx, userId: string, coupon?: string) {
    const cart = await tx.cart.findUnique({
      where: { buyerId: userId },
      include: {
        items: {
          orderBy: { variantId: 'asc' },
          include: {
            variant: { include: { product: { include: { seller: true, category: true } } } },
          },
        },
      },
    });
    const items = (cart?.items ?? []).map((item) => {
      const v = item.variant,
        p = v.product;
      const available =
        v.isActive &&
        p.status === 'ACTIVE' &&
        p.seller.status === 'ACTIVE' &&
        !p.category.deletedAt;
      const quantity = available ? Math.min(item.quantity, v.stockQuantity) : 0;
      return {
        cartItemId: item.id,
        variantId: v.id,
        productId: p.id,
        sellerId: p.sellerId,
        title: p.titleI18n,
        requestedQuantity: item.quantity,
        quantity,
        available,
        price: v.price,
        gross: money(v.price.times(quantity)),
        discountAmount: zero(),
        platformDiscountAmount: zero(),
        deliveryAmount: zero(),
        deliveryType: item.deliveryType,
        appliedPromotionId: undefined as string | undefined,
        taxRate: p.seller.taxRate,
        commissionRate: p.seller.commissionRate,
      };
    });
    const promotions = await tx.promotion.findMany({ where: { isActive: true } });
    const first = !(await tx.order.findFirst({
      where: { buyerId: userId, paymentStatus: { in: ['PAID', 'PENDING'] } },
      select: { id: true },
    }));
    const reminders: { sellerId: string; remaining: string }[] = [];
    for (const sellerId of [...new Set(items.map((i) => i.sellerId))]) {
      const group = items.filter((i) => i.sellerId === sellerId && i.quantity > 0);
      if (!group.length) continue;
      ensure(
        new Set(group.map((i) => i.deliveryType)).size === 1,
        'Bir do‘kon uchun bitta yetkazish turini tanlang',
      );
      const subtotal = group.reduce((s, i) => s.plus(i.gross), zero());
      const own = promotions.filter((p) => p.scope === 'SELLER' && p.sellerId === sellerId);
      const best = bestPromotion(own, subtotal, first, coupon);
      if (best?.discount.gt(0)) {
        const parts = allocate(
          best.discount,
          group.map((i) => i.gross),
        );
        group.forEach((i, n) => {
          i.discountAmount = parts[n];
          i.appliedPromotionId = best.promotion.id;
        });
      }
      const min = own
        .filter(
          (p) =>
            p.minAmount?.gt(subtotal) &&
            (!p.startAt || p.startAt <= new Date()) &&
            (!p.endAt || p.endAt > new Date()) &&
            (!p.firstPurchaseOnly || first) &&
            (!p.couponCode || p.couponCode === coupon),
        )
        .sort((a, b) => a.minAmount!.comparedTo(b.minAmount!))[0];
      if (min) reminders.push({ sellerId, remaining: min.minAmount!.minus(subtotal).toFixed(2) });
      const type = group[0].deliveryType;
      const tariff = type === 'FREE' ? '0' : process.env[`DELIVERY_${type}_AMOUNT`];
      ensure(tariff && /^\d+(\.\d{1,2})?$/.test(tariff), 'Yetkazish tarifi sozlanmagan');
      group[0].deliveryAmount = money(tariff); // One static tariff per seller group.
    }
    const eligible = items.filter((i) => i.quantity > 0);
    const goods = eligible.map((i) => i.gross.minus(i.discountAmount));
    const subtotal = goods.reduce((s, i) => s.plus(i), zero());
    const platform = bestPromotion(
      promotions.filter((p) => p.scope === 'PLATFORM'),
      subtotal,
      first,
      coupon,
    );
    if (platform?.discount.gt(0)) {
      const parts = allocate(platform.discount, goods);
      eligible.forEach((i, n) => {
        i.platformDiscountAmount = parts[n];
      });
    }
    const total = eligible.reduce(
      (s, i) =>
        s
          .plus(i.gross)
          .minus(i.discountAmount)
          .minus(i.platformDiscountAmount)
          .plus(i.deliveryAmount),
      zero(),
    );
    const credit = Prisma.Decimal.max(0, await this.ledger.spendable(tx, 'BUYER', userId));
    const creditApplied = Prisma.Decimal.min(total, credit);
    const quoteHash = createHash('sha256')
      .update(JSON.stringify({ userId, items, total, creditApplied }))
      .digest('hex');
    return {
      cartId: cart?.id,
      quoteHash,
      items,
      reminders,
      totalAmount: total,
      creditApplied,
      payable: total.minus(creditApplied),
    };
  }
  preview(userId: string, coupon?: string) {
    return this.db.$transaction((tx) => this.quote(tx, userId, coupon));
  }
}
