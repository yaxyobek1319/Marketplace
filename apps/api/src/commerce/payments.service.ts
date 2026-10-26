import { processPages } from '../common/batch';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProviderRegistry } from '../integrations/providers';
import { emit, ensure, lock, required } from '../common/core';
import { OrdersService } from './orders.service';
import { LedgerService } from './ledger.service';
import { SellersService } from '../sellers/sellers.service';
@Injectable()
export class PaymentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly orders: OrdersService,
    private readonly ledger: LedgerService,
    private readonly sellers: SellersService,
  ) {}
  async create(paymentId: string) {
    const payment = required(await this.db.payment.findUnique({ where: { id: paymentId } }));
    if (payment.status !== 'PENDING' || payment.providerRef) return;
    const result = await this.providers
      .payment(payment.provider)
      .create(payment.id, payment.amount.toFixed(2));
    await this.db.payment.update({
      where: { id: payment.id },
      data: { providerRef: result.reference, checkoutUrl: result.redirectUrl },
    });
    // Provider must use payment.id as its idempotency key on every retry.
  }
  async webhook(provider: string, headers: Record<string, string>, rawBody: Buffer) {
    const result = await this.providers.payment(provider).verifyWebhook(headers, rawBody);
    if (result.status === 'PENDING') return { accepted: true };
    return this.apply(
      provider,
      result.eventId,
      result.paymentId,
      result.reference,
      result.amount,
      result.status,
    );
  }
  async apply(
    provider: string,
    eventId: string,
    paymentId: string,
    reference: string,
    amount: string,
    status: 'PAID' | 'FAILED',
  ) {
    const payment = required(
      await this.db.payment.findUnique({ where: { id: paymentId }, include: { order: true } }),
    );
    return this.db.$transaction(
      async (tx) => {
        if (payment.order) await lock(tx, `buyer:${payment.order.buyerId}`);
        if (payment.sellerId) await lock(tx, `seller:${payment.sellerId}`);
        await lock(tx, `payment:${paymentId}`);
        const current = required(await tx.payment.findUnique({ where: { id: paymentId } }));
        ensure(
          current.provider === provider &&
            current.amount.eq(amount) &&
            (!current.providerRef || current.providerRef === reference),
          'Provayder yoki summa mos emas',
        );
        const duplicate = await tx.paymentWebhookEvent.findUnique({
          where: { provider_providerEventId: { provider, providerEventId: eventId } },
        });
        if (duplicate?.processedAt) return { accepted: true };
        if (current.status !== 'PAID' && status === 'PAID') {
          if (current.purpose === 'ORDER') {
            const order = required(await tx.order.findUnique({ where: { id: current.orderId! } }));
            if (order.paymentStatus === 'PENDING')
              await this.orders.fundOrder(tx, order.id, current.amount);
            else {
              // A delayed confirmed payment after reservation expiry is credited, never resurrects stock reservations.
              ensure(order.paymentStatus !== 'PAID', 'Buyurtma boshqa to‘lov bilan to‘langan');
              await this.ledger.post(tx, `late-payment:${paymentId}`, [
                { account: 'PLATFORM_CASH', direction: 'DEBIT', amount },
                { account: 'BUYER_CREDIT', ownerId: order.buyerId, direction: 'CREDIT', amount },
              ]);
            }
          } else {
            const seller = required(
              await tx.seller.findUnique({ where: { id: current.sellerId! } }),
            );
            ensure(
              ['APPROVED_AWAITING_DEPOSIT', 'ACTIVE'].includes(seller.status),
              'Depozit qabul qilinadigan holat emas',
            );
            await this.ledger.post(tx, `deposit:${paymentId}`, [
              { account: 'PLATFORM_CASH', direction: 'DEBIT', amount },
              { account: 'SELLER_DEPOSIT', ownerId: seller.id, direction: 'CREDIT', amount },
            ]);
            const balance = seller.depositBalance.plus(amount);
            const needed = await this.sellers.requiredDeposit(tx, seller.id);
            await tx.seller.update({
              where: { id: seller.id },
              data: {
                depositBalance: balance,
                status: balance.minus(seller.depositHeldAmount).gte(needed)
                  ? 'ACTIVE'
                  : seller.status,
              },
            });
          }
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'PAID', providerRef: reference },
          });
        } else if (current.status !== 'PAID' && status === 'FAILED') {
          await tx.payment.update({
            where: { id: paymentId },
            data: { status: 'FAILED', providerRef: reference },
          });
          if (current.orderId) await this.expire(tx, current.orderId);
        }
        await tx.paymentWebhookEvent.upsert({
          where: { provider_providerEventId: { provider, providerEventId: eventId } },
          create: {
            provider,
            providerEventId: eventId,
            payload: { paymentId, reference, amount, status },
            processedAt: new Date(),
          },
          update: { processedAt: new Date() },
        });
        return { accepted: true };
      },
      { timeout: 20000 },
    );
  }
  async expire(tx: import('../common/core').Tx, orderId: string) {
    const order = required(
      await tx.order.findUnique({ where: { id: orderId }, include: { items: true } }),
    );
    if (order.paymentStatus !== 'PENDING') return;
    // No credit was debited while pending; releasing status releases its credit reservation.
    await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'EXPIRED' } });
    for (const item of order.items) {
      await this.orders.restoreStock(tx, item, order.buyerId);
      await tx.orderItem.update({ where: { id: item.id }, data: { status: 'CANCELLED' } });
    }
  }
  async deposit(userId: string, amount: string, provider: string) {
    this.providers.payment(provider);
    return this.db.$transaction(async (tx) => {
      const original = await this.sellers.own(tx, userId);
      await lock(tx, `seller:${original.id}`);
      const seller = await this.sellers.own(tx, userId);
      ensure(
        ['APPROVED_AWAITING_DEPOSIT', 'ACTIVE'].includes(seller.status),
        'Do‘kon hali tasdiqlanmagan',
      );
      const payment = await tx.payment.create({
        data: { sellerId: seller.id, purpose: 'DEPOSIT', provider, amount },
      });
      await emit(tx, 'payment.create', { paymentId: payment.id });
      return payment;
    });
  }
  async poll() {
    await processPages(
      (after) =>
        this.db.payment.findMany({
          where: {
            status: 'PENDING',
            providerRef: { not: null },
            ...(after ? { id: { gt: after } } : {}),
          },
          take: 200,
          orderBy: { id: 'asc' },
        }),
      async (p) => {
        const result = await this.providers.payment(p.provider).status(p.providerRef!);
        if (result.status === 'PAID' || result.status === 'FAILED')
          await this.apply(
            p.provider,
            `poll:${p.id}:${result.status}`,
            p.id,
            result.reference,
            result.amount,
            result.status,
          );
        if (result.status === 'PENDING' && p.orderId) {
          const order = required(await this.db.order.findUnique({ where: { id: p.orderId } }));
          if (order.paymentExpiresAt <= new Date()) {
            const cancelled = await this.providers.payment(p.provider).cancel(p.providerRef!);
            if (cancelled.status !== 'PENDING')
              await this.apply(
                p.provider,
                `expiry:${p.id}:${cancelled.status}`,
                p.id,
                cancelled.reference,
                cancelled.amount,
                cancelled.status,
              );
          }
        }
        // Unknown provider state never frees a reservation; cancellation must confirm a terminal state.
      },
    );
  }
}
