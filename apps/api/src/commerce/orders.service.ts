import { processPages } from '../common/batch';
import { Injectable } from '@nestjs/common';
import { OrderItem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { emit, ensure, hoursFromNow, lock, money, required, Tx, zero } from '../common/core';
import { CartService } from './cart.service';
import { LedgerService, Posting } from './ledger.service';
import { allocate } from './pricing';
import { ProviderRegistry } from '../integrations/providers';
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: PrismaService,
    private readonly cart: CartService,
    private readonly ledger: LedgerService,
    private readonly providers: ProviderRegistry,
  ) {}
  async checkout(
    userId: string,
    dto: {
      addressId: string;
      idempotencyKey: string;
      provider: string;
      expectedTotal: string;
      quoteHash: string;
      coupon?: string;
    },
  ) {
    return this.db.$transaction(
      async (tx) => {
        await lock(tx, `buyer:${userId}`);
        const checkoutKey = `${userId}:${dto.idempotencyKey}`;
        const existing = await tx.order.findUnique({
          where: { checkoutKey },
          include: { items: true, payments: true },
        });
        if (existing) return existing;
        const address = required(
          await tx.address.findFirst({ where: { id: dto.addressId, userId } }),
        );
        const cart = await tx.cart.findUnique({
          where: { buyerId: userId },
          include: {
            items: {
              include: {
                variant: { select: { productId: true, product: { select: { sellerId: true } } } },
              },
            },
          },
        });
        await lock(tx, 'category-tree');
        for (const productId of [
          ...new Set((cart?.items ?? []).map((i) => i.variant.productId)),
        ].sort())
          await lock(tx, `product:${productId}`);
        for (const sellerId of [
          ...new Set((cart?.items ?? []).map((i) => i.variant.product.sellerId)),
        ].sort())
          await lock(tx, `seller:${sellerId}`);
        for (const i of [...(cart?.items ?? [])].sort((a, b) =>
          a.variantId.localeCompare(b.variantId),
        ))
          await tx.$queryRaw`SELECT id FROM "ProductVariant" WHERE id = ${i.variantId} FOR UPDATE`;
        const quote = await this.cart.quote(tx, userId, dto.coupon);
        const items = quote.items.filter((i) => i.quantity > 0);
        ensure(items.length, 'Savat bo‘sh yoki mahsulotlar mavjud emas');
        ensure(
          quote.quoteHash === dto.quoteHash,
          'Savat o‘zgargan. Yangilangan taklifni tasdiqlang',
        );
        ensure(
          quote.totalAmount.eq(dto.expectedTotal),
          'Narx yoki zaxira o‘zgargan. Savatni qayta tekshiring',
        );
        if (quote.payable.gt(0)) this.providers.payment(dto.provider);
        const credits = allocate(
          quote.creditApplied,
          items.map((i) =>
            i.gross.minus(i.discountAmount).minus(i.platformDiscountAmount).plus(i.deliveryAmount),
          ),
        );
        const order = await tx.order.create({
          data: {
            buyerId: userId,
            checkoutKey,
            totalAmount: quote.totalAmount,
            creditApplied: quote.creditApplied,
            paymentExpiresAt: new Date(Date.now() + 30 * 60000),
            deliveryAddress: {
              address: address.address,
              recipientPhone: address.recipientPhone,
              region: address.region,
            },
            items: {
              create: items.map((i, n) => ({
                variantId: i.variantId,
                sellerId: i.sellerId,
                titleAtPurchase: i.title as Prisma.InputJsonValue,
                quantity: i.quantity,
                priceAtPurchase: i.price,
                discountAmount: i.discountAmount,
                platformDiscountAmount: i.platformDiscountAmount,
                deliveryAmount: i.deliveryAmount,
                deliveryType: i.deliveryType,
                appliedPromotionId: i.appliedPromotionId,
                creditApplied: credits[n],
                taxRateAtPurchase: i.taxRate,
                taxAmount: money(i.gross.minus(i.discountAmount).times(i.taxRate).div(100)),
                commissionRateAtPurchase: i.commissionRate,
                commissionAmount: money(
                  i.gross.minus(i.discountAmount).times(i.commissionRate).div(100),
                ),
              })),
            },
          },
          include: { items: true, payments: true },
        });
        for (const i of items) {
          await tx.productVariant.update({
            where: { id: i.variantId },
            data: { stockQuantity: { decrement: i.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              variantId: i.variantId,
              changeAmount: -i.quantity,
              type: 'SALE',
              reason: `Order reservation ${order.id}`,
              createdBy: userId,
            },
          });
          await emit(tx, 'search.product', { productId: i.productId });
        }
        await tx.cartItem.deleteMany({
          where: { cartId: quote.cartId, id: { in: items.map((i) => i.cartItemId) } },
        });
        if (quote.payable.eq(0)) {
          await this.fundOrder(tx, order.id, zero());
        } else {
          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              purpose: 'ORDER',
              provider: dto.provider,
              amount: quote.payable,
            },
          });
          await emit(tx, 'payment.create', { paymentId: payment.id });
        }
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true, payments: true },
        });
      },
      { timeout: 20000 },
    );
  }
  gross(item: OrderItem) {
    return money(item.priceAtPurchase.times(item.quantity).minus(item.discountAmount));
  }
  paidGoods(item: OrderItem) {
    return this.gross(item).minus(item.platformDiscountAmount);
  }
  async fundOrder(tx: Tx, orderId: string, cash: Prisma.Decimal) {
    const order = required(
      await tx.order.findUnique({ where: { id: orderId }, include: { items: true } }),
    );
    ensure(order.paymentStatus === 'PENDING', 'Buyurtma to‘lov kutmayapti');
    ensure(cash.plus(order.creditApplied).eq(order.totalAmount), 'To‘lov summasi mos emas');
    const entries: Posting[] = [
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: cash, orderId },
      {
        account: 'BUYER_CREDIT',
        ownerId: order.buyerId,
        direction: 'DEBIT',
        amount: order.creditApplied,
        orderId,
      },
    ];
    for (const i of order.items) {
      entries.push(
        {
          account: 'SELLER_FROZEN',
          ownerId: i.sellerId,
          direction: 'CREDIT',
          amount: this.gross(i),
          orderId,
          orderItemId: i.id,
        },
        {
          account: 'PLATFORM_SUBSIDY_EXPENSE',
          direction: 'DEBIT',
          amount: i.platformDiscountAmount,
          orderId,
          orderItemId: i.id,
        },
        {
          account: 'PLATFORM_SUBSIDY_EXPENSE',
          direction: 'CREDIT',
          amount: i.deliveryAmount,
          orderId,
          orderItemId: i.id,
        },
      );
    }
    await this.ledger.post(tx, `order-paid:${orderId}`, entries);
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID', paidAt: new Date() },
    });
    await tx.orderItem.updateMany({
      where: { orderId },
      data: { confirmDeadline: hoursFromNow(24) },
    });
    for (const sellerId of [...new Set(order.items.map((i) => i.sellerId))]) {
      const seller = required(await tx.seller.findUnique({ where: { id: sellerId } }));
      await emit(tx, 'notification', {
        eventKey: `order-paid:${orderId}:${sellerId}`,
        userId: seller.userId,
        eventType: 'SELLER_CONFIRMATION_NEEDED',
        payload: { orderId },
      });
    }
  }
  async confirm(userId: string, itemId: string, accept: boolean) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: { id: itemId, variant: { product: { seller: { userId, status: 'ACTIVE' } } } },
          include: { order: true },
        }),
      );
      ensure(
        item.order.paymentStatus === 'PAID' && item.status === 'PENDING_SELLER_CONFIRMATION',
        'Tasdiqlash mumkin emas',
      );
      ensure(
        item.confirmDeadline && item.confirmDeadline > new Date(),
        'Tasdiqlash muddati tugagan',
      );
      if (!accept) return this.cancel(tx, item, 'SELLER_CANCELLED');
      return tx.orderItem.update({ where: { id: itemId }, data: { status: 'CONFIRMED' } });
    });
  }
  async cancel(tx: Tx, item: OrderItem, penalty?: 'SELLER_CANCELLED' | 'MISSED_CONFIRMATION') {
    const order = required(await tx.order.findUnique({ where: { id: item.orderId } }));
    const gross = this.gross(item),
      refund = gross.minus(item.platformDiscountAmount).plus(item.deliveryAmount);
    if (order.paymentStatus === 'PAID')
      await this.ledger.post(tx, `item-cancel:${item.id}`, [
        {
          account: 'SELLER_FROZEN',
          ownerId: item.sellerId,
          direction: 'DEBIT',
          amount: gross,
          orderItemId: item.id,
        },
        {
          account: 'PLATFORM_SUBSIDY_EXPENSE',
          direction: 'DEBIT',
          amount: item.deliveryAmount,
          orderItemId: item.id,
        },
        {
          account: 'BUYER_CREDIT',
          ownerId: order.buyerId,
          direction: 'CREDIT',
          amount: refund,
          orderItemId: item.id,
        },
        {
          account: 'PLATFORM_SUBSIDY_EXPENSE',
          direction: 'CREDIT',
          amount: item.platformDiscountAmount,
          orderItemId: item.id,
        },
      ]);
    await this.restoreStock(tx, item, order.buyerId);
    if (penalty) {
      await lock(tx, `seller:${item.sellerId}`);
      const seller = required(await tx.seller.findUnique({ where: { id: item.sellerId } }));
      await tx.sellerRatingEvent.create({
        data: { sellerId: item.sellerId, orderItemId: item.id, reason: penalty, points: -1 },
      });
      await tx.seller.update({
        where: { id: item.sellerId },
        data: { rating: Prisma.Decimal.max(0, seller.rating.minus(1)) },
      });
      await emit(tx, 'search.seller', { sellerId: item.sellerId });
    }
    return tx.orderItem.update({
      where: { id: item.id },
      data: { status: 'CANCELLED', autoConfirmAt: null, confirmDeadline: null },
    });
  }
  async restoreStock(tx: Tx, item: OrderItem, createdBy: string) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        variantId: item.variantId,
        type: 'RETURN',
        changeAmount: item.quantity,
        reason: `Order ${item.orderId}`,
        createdBy,
      },
    });
    const v = required(await tx.productVariant.findUnique({ where: { id: item.variantId } }));
    await emit(tx, 'search.product', { productId: v.productId });
  }
  async complete(userId: string, itemId: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: { id: itemId, order: { buyerId: userId, paymentStatus: 'PAID' } },
        }),
      );
      ensure(item.status === 'SHIPPED', 'Faqat jo‘natilgan xarid tasdiqlanadi');
      return this.settle(tx, item, zero());
    });
  }
  // Also called by the dispute service while holding the same item lock.
  async settle(tx: Tx, item: OrderItem, buyerRefund: Prisma.Decimal) {
    const order = required(await tx.order.findUnique({ where: { id: item.orderId } }));
    const paidGoods = this.paidGoods(item),
      gross = this.gross(item);
    ensure(buyerRefund.gte(0) && buyerRefund.lte(paidGoods), 'Qisman qaytarish summasi noto‘g‘ri');
    const subsidyReversal = paidGoods.gt(0)
      ? money(item.platformDiscountAmount.times(buyerRefund).div(paidGoods))
      : zero();
    const settled = gross.minus(buyerRefund).minus(subsidyReversal);
    const tax = money(settled.times(item.taxRateAtPurchase).div(100));
    const commission = Prisma.Decimal.min(
      money(settled.times(item.commissionRateAtPurchase).div(100)),
      settled.minus(tax),
    );
    const net = settled.minus(tax).minus(commission);
    ensure(net.gte(0), 'Sof summa manfiy');
    await lock(tx, `seller:${item.sellerId}`);
    await this.ledger.post(tx, `item-settle:${item.id}`, [
      {
        account: 'SELLER_FROZEN',
        ownerId: item.sellerId,
        direction: 'DEBIT',
        amount: gross,
        orderItemId: item.id,
      },
      {
        account: 'SELLER_AVAILABLE',
        ownerId: item.sellerId,
        direction: 'CREDIT',
        amount: net,
        orderItemId: item.id,
      },
      { account: 'PLATFORM_TAX_PAYABLE', direction: 'CREDIT', amount: tax, orderItemId: item.id },
      {
        account: 'PLATFORM_COMMISSION_REVENUE',
        direction: 'CREDIT',
        amount: commission,
        orderItemId: item.id,
      },
      {
        account: 'BUYER_CREDIT',
        ownerId: order.buyerId,
        direction: 'CREDIT',
        amount: buyerRefund,
        orderItemId: item.id,
      },
      {
        account: 'PLATFORM_SUBSIDY_EXPENSE',
        direction: 'CREDIT',
        amount: subsidyReversal,
        orderItemId: item.id,
      },
    ]);
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { salesCount: { increment: item.quantity } },
    });
    return tx.orderItem.update({
      where: { id: item.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        autoConfirmAt: null,
        settledAmount: settled,
        settledSubsidyAmount: item.platformDiscountAmount.minus(subsidyReversal),
        taxAmount: tax,
        commissionAmount: commission,
      },
    });
  }
  async deadlines() {
    await processPages(
      (after) =>
        this.db.orderItem.findMany({
          where: {
            ...(after ? { id: { gt: after } } : {}),
            OR: [
              {
                status: 'PENDING_SELLER_CONFIRMATION',
                confirmDeadline: { lte: new Date() },
                order: { paymentStatus: 'PAID' },
              },
              { status: 'SHIPPED', autoConfirmAt: { lte: new Date() } },
            ],
          },
          select: { id: true },
          take: 200,
          orderBy: { id: 'asc' },
        }),
      async ({ id }) =>
        this.db.$transaction(async (tx) => {
          await lock(tx, `item:${id}`);
          const item = required(await tx.orderItem.findUnique({ where: { id } }));
          if (
            item.status === 'PENDING_SELLER_CONFIRMATION' &&
            item.confirmDeadline &&
            item.confirmDeadline <= new Date()
          )
            await this.cancel(tx, item, 'MISSED_CONFIRMATION');
          if (item.status === 'SHIPPED' && item.autoConfirmAt && item.autoConfirmAt <= new Date())
            await this.settle(tx, item, zero());
        }),
    );
  }
}
