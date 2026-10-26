import { processPages } from '../common/batch';
import { Injectable } from '@nestjs/common';
import { DisputeReason, DisputeResolution, Prisma, ReturnReason } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  audit,
  configuredHours,
  emit,
  ensure,
  hoursFromNow,
  lock,
  money,
  required,
  Tx,
  zero,
} from '../common/core';
import { OrdersService } from '../commerce/orders.service';
import { LedgerService } from '../commerce/ledger.service';
import { CatalogService } from '../catalog/catalog.service';
@Injectable()
export class TrustService {
  constructor(
    private readonly db: PrismaService,
    private readonly orders: OrdersService,
    private readonly ledger: LedgerService,
    private readonly catalog: CatalogService,
  ) {}
  async dispute(
    userId: string,
    itemId: string,
    reason: DisputeReason,
    evidence: Prisma.InputJsonValue,
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: { id: itemId, order: { buyerId: userId, paymentStatus: 'PAID' } },
        }),
      );
      ensure(item.status === 'SHIPPED', 'Nizo faqat jo‘natilgan xaridga ochiladi');
      const result = await tx.dispute.create({
        data: {
          orderItemId: itemId,
          reason,
          buyerEvidence: evidence,
          sellerResponseDeadline: hoursFromNow(configuredHours('DISPUTE_RESPONSE_HOURS')),
        },
      });
      await tx.orderItem.update({
        where: { id: itemId },
        data: { status: 'DISPUTED', autoConfirmAt: null },
      });
      const seller = required(await tx.seller.findUnique({ where: { id: item.sellerId } }));
      await emit(tx, 'notification', {
        eventKey: `dispute-open:${result.id}`,
        userId: seller.userId,
        eventType: 'DISPUTE_OPENED',
        payload: { orderItemId: itemId },
      });
      return result;
    });
  }
  async disputeResponse(userId: string, disputeId: string, evidence: Prisma.InputJsonValue) {
    const existing = required(await this.db.dispute.findUnique({ where: { id: disputeId } }));
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${existing.orderItemId}`);
      const d = required(
        await tx.dispute.findFirst({
          where: { id: disputeId, orderItem: { variant: { product: { seller: { userId } } } } },
        }),
      );
      ensure(
        d.status !== 'RESOLVED' &&
          d.sellerResponseDeadline &&
          d.sellerResponseDeadline > new Date(),
        'Javob muddati tugagan',
      );
      return tx.dispute.update({
        where: { id: disputeId },
        data: { sellerEvidence: evidence, status: 'UNDER_REVIEW' },
      });
    });
  }
  async resolve(
    staffId: string | null,
    disputeId: string,
    resolution: DisputeResolution,
    amount?: string,
  ) {
    const original = required(await this.db.dispute.findUnique({ where: { id: disputeId } }));
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${original.orderItemId}`);
      const dispute = required(
        await tx.dispute.findUnique({
          where: { id: disputeId },
          include: { orderItem: { include: { order: true } } },
        }),
      );
      ensure(
        dispute.status !== 'RESOLVED' && dispute.orderItem.status === 'DISPUTED',
        'Nizo allaqachon hal qilingan',
      );
      if (!staffId)
        ensure(
          !dispute.sellerEvidence &&
            dispute.sellerResponseDeadline &&
            dispute.sellerResponseDeadline <= new Date(),
          'Avtomatik qaror sharti bajarilmadi',
        );
      if (resolution === 'BUYER_FAVOR') {
        // Missing/damaged goods do not automatically become sellable stock.
        await this.refundDispute(tx, dispute.orderItem);
      } else {
        ensure(
          resolution !== 'PARTIAL' ||
            (amount &&
              money(amount).gt(0) &&
              money(amount).lt(this.orders.paidGoods(dispute.orderItem))),
          'Qisman summa to‘liq summadan kichik bo‘lsin',
        );
        await this.orders.settle(
          tx,
          dispute.orderItem,
          resolution === 'PARTIAL' ? money(amount!) : zero(),
        );
      }
      const result = await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'RESOLVED',
          resolution,
          resolutionAmount: resolution === 'PARTIAL' ? amount : null,
          resolvedBy: staffId,
          resolvedAt: new Date(),
        },
      });
      if (staffId)
        await audit(tx, staffId, 'DISPUTE_RESOLVED', 'Dispute', disputeId, {
          resolution,
          amount: amount ?? null,
        });
      const seller = required(
        await tx.seller.findUnique({ where: { id: dispute.orderItem.sellerId } }),
      );
      for (const userId of [dispute.orderItem.order.buyerId, seller.userId])
        await emit(tx, 'notification', {
          eventKey: `dispute-resolved:${disputeId}`,
          userId,
          eventType: 'DISPUTE_RESOLVED',
          payload: { disputeId, resolution },
        });
      return result;
    });
  }
  async refundDispute(tx: Tx, item: import('@prisma/client').OrderItem) {
    const order = required(await tx.order.findUnique({ where: { id: item.orderId } }));
    await this.ledger.post(tx, `dispute-refund:${item.id}`, [
      {
        account: 'SELLER_FROZEN',
        ownerId: item.sellerId,
        direction: 'DEBIT',
        amount: this.orders.gross(item),
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
        amount: this.orders.paidGoods(item).plus(item.deliveryAmount),
        orderItemId: item.id,
      },
      {
        account: 'PLATFORM_SUBSIDY_EXPENSE',
        direction: 'CREDIT',
        amount: item.platformDiscountAmount,
        orderItemId: item.id,
      },
    ]);
    await tx.orderItem.update({
      where: { id: item.id },
      data: { status: 'CANCELLED', autoConfirmAt: null },
    });
  }
  async requestReturn(
    userId: string,
    itemId: string,
    reason: ReturnReason,
    evidence: Prisma.InputJsonValue,
    unusedOriginalPackaging: boolean,
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: { id: itemId, order: { buyerId: userId } },
          include: { dispute: true },
        }),
      );
      ensure(
        item.status === 'COMPLETED' &&
          item.completedAt &&
          Date.now() - item.completedAt.getTime() <= 7 * 86400000,
        'Qaytarish muddati tugagan yoki xarid yakunlanmagan',
      );
      ensure(!item.dispute || item.dispute.status === 'RESOLVED', 'Ochiq nizo mavjud');
      ensure(
        reason !== 'CHANGED_MIND' || unusedOriginalPackaging,
        'Tovar ishlatilmagan va original qadoqda bo‘lishi kerak',
      );
      await lock(tx, `seller:${item.sellerId}`);
      return tx.returnRequest.create({
        data: {
          orderItemId: itemId,
          reason,
          evidencePhotos: evidence,
          returnShippingPaidBy: reason === 'CHANGED_MIND' ? 'BUYER' : 'PLATFORM',
        },
      });
    });
  }
  async returnResponse(userId: string, returnId: string, evidence: Prisma.InputJsonValue) {
    return this.db.returnRequest.update({
      where: {
        id: returnId,
        status: 'REQUESTED',
        orderItem: { variant: { product: { seller: { userId } } } },
      },
      data: { sellerEvidence: evidence },
    });
  }
  async returnDecision(staffId: string, returnId: string, approve: boolean) {
    const original = required(await this.db.returnRequest.findUnique({ where: { id: returnId } }));
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${original.orderItemId}`);
      const request = required(await tx.returnRequest.findUnique({ where: { id: returnId } }));
      ensure(request.status === 'REQUESTED', 'So‘rov allaqachon ko‘rib chiqilgan');
      const result = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          resolvedBy: staffId,
          resolvedAt: new Date(),
        },
      });
      await audit(tx, staffId, 'RETURN_RESOLVED', 'ReturnRequest', returnId, { approve });
      return result;
    });
  }
  async returnReceived(userId: string, returnId: string) {
    return this.db.returnRequest.update({
      where: {
        id: returnId,
        status: 'APPROVED',
        orderItem: { variant: { product: { seller: { userId } } } },
      },
      data: { status: 'ITEM_RECEIVED', receivedAt: new Date() },
    });
  }
  async returnRefund(staffId: string, returnId: string, restock: boolean) {
    const original = required(await this.db.returnRequest.findUnique({ where: { id: returnId } }));
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${original.orderItemId}`);
      const request = required(
        await tx.returnRequest.findUnique({
          where: { id: returnId },
          include: { orderItem: { include: { order: true } } },
        }),
      );
      ensure(
        request.status === 'ITEM_RECEIVED' && request.orderItem.status === 'COMPLETED',
        'Qaytarilgan tovar qabul qilinmagan',
      );
      const item = request.orderItem;
      await lock(tx, `seller:${item.sellerId}`);
      const settled = required(item.settledAmount),
        net = settled.minus(item.taxAmount).minus(item.commissionAmount);
      // Existing payout reservations remain protected. Seller funding shortfalls require finance intervention.
      const available = await this.ledger.spendable(tx, 'SELLER', item.sellerId, returnId);
      ensure(
        available.gte(net),
        'Sotuvchi balansida mablag‘ yetarli emas; moliya bo‘limi ko‘rib chiqishi kerak',
      );
      const subsidy = item.settledSubsidyAmount ?? item.platformDiscountAmount;
      const refund = settled.minus(subsidy).plus(item.deliveryAmount);
      await this.ledger.post(tx, `return:${returnId}`, [
        {
          account: 'SELLER_AVAILABLE',
          ownerId: item.sellerId,
          direction: 'DEBIT',
          amount: net,
          orderItemId: item.id,
        },
        {
          account: 'PLATFORM_TAX_PAYABLE',
          direction: 'DEBIT',
          amount: item.taxAmount,
          orderItemId: item.id,
        },
        {
          account: 'PLATFORM_COMMISSION_REVENUE',
          direction: 'DEBIT',
          amount: item.commissionAmount,
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
          ownerId: item.order.buyerId,
          direction: 'CREDIT',
          amount: refund,
          orderItemId: item.id,
        },
        {
          account: 'PLATFORM_SUBSIDY_EXPENSE',
          direction: 'CREDIT',
          amount: subsidy,
          orderItemId: item.id,
        },
      ]);
      if (restock) await this.orders.restoreStock(tx, item, staffId);
      await tx.orderItem.update({ where: { id: item.id }, data: { status: 'RETURNED' } });
      const result = await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: 'REFUNDED' },
      });
      await audit(tx, staffId, 'RETURN_RESOLVED', 'ReturnRequest', returnId, {
        refunded: refund.toFixed(2),
        restock,
      });
      return result;
    });
  }
  async review(
    userId: string,
    itemId: string,
    data: { rating: number; comment?: string; photos: string[] },
  ) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: { id: itemId, status: 'COMPLETED', order: { buyerId: userId } },
          include: { variant: true },
        }),
      );
      const scan = await this.catalog.scan(tx, data.comment ?? '');
      ensure(scan.result !== 'BLOCKED', 'Sharhda taqiqlangan matn mavjud');
      const result = await tx.review.create({
        data: { ...data, buyerId: userId, orderItemId: itemId, productId: item.variant.productId },
      });
      await emit(tx, 'search.product', { productId: result.productId });
      return result;
    });
  }
  async editReview(
    userId: string,
    reviewId: string,
    data: { rating: number; comment?: string; photos: string[] },
  ) {
    return this.db.$transaction(async (tx) => {
      const review = required(
        await tx.review.findFirst({ where: { id: reviewId, buyerId: userId, deletedAt: null } }),
      );
      ensure(
        (await this.catalog.scan(tx, data.comment ?? '')).result !== 'BLOCKED',
        'Sharhda taqiqlangan matn mavjud',
      );
      const result = await tx.review.update({ where: { id: reviewId }, data });
      await emit(tx, 'search.product', { productId: review.productId });
      return result;
    });
  }
  async deleteReview(actorId: string, reviewId: string, reason: string, staff: boolean) {
    return this.db.$transaction(async (tx) => {
      const review = required(
        await tx.review.findFirst({
          where: { id: reviewId, ...(staff ? {} : { buyerId: actorId }) },
        }),
      );
      await tx.review.update({
        where: { id: reviewId },
        data: { deletedAt: new Date(), deletedReason: reason },
      });
      if (staff) await audit(tx, actorId, 'REVIEW_DELETED', 'Review', reviewId, { reason });
      await emit(tx, 'search.product', { productId: review.productId });
      return { deleted: true };
    });
  }
  async reply(userId: string, reviewId: string, reply: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `review:${reviewId}`);
      const review = required(
        await tx.review.findFirst({
          where: { id: reviewId, deletedAt: null, product: { seller: { userId } } },
        }),
      );
      ensure(!review.sellerReplyAt, 'Faqat bitta javob mumkin');
      ensure((await this.catalog.scan(tx, reply)).result !== 'BLOCKED', 'Taqiqlangan matn');
      return tx.review.update({
        where: { id: reviewId },
        data: { sellerReply: reply, sellerReplyAt: new Date() },
      });
    });
  }
  async deadlines() {
    await processPages(
      (after) =>
        this.db.dispute.findMany({
          where: {
            ...(after ? { id: { gt: after } } : {}),
            status: 'OPEN',
            sellerResponseDeadline: { lte: new Date() },
            sellerEvidence: { equals: Prisma.DbNull },
          },
          take: 200,
          orderBy: { id: 'asc' },
        }),
      async (d) => {
        // A seller reply or staff decision may have arrived since this batch was read.
        const latest = await this.db.dispute.findUnique({ where: { id: d.id } });
        if (latest?.status === 'OPEN' && !latest.sellerEvidence)
          await this.resolve(null, d.id, 'BUYER_FAVOR');
      },
    );
  }
}
