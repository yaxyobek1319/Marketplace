import { processPages } from '../common/batch';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProviderRegistry } from '../integrations/providers';
import { audit, emit, ensure, lock, money, required, zero } from '../common/core';
import { LedgerService } from './ledger.service';
@Injectable()
export class PayoutsService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly providers: ProviderRegistry,
  ) {}
  async request(
    userId: string,
    data: {
      payeeType: 'BUYER' | 'SELLER';
      amount: string;
      provider: string;
      destinationToken: string;
      destinationMasked: string;
      idempotencyKey: string;
    },
  ) {
    this.providers.payout(data.provider);
    const seller =
      data.payeeType === 'SELLER'
        ? required(await this.db.seller.findFirst({ where: { userId, status: 'ACTIVE' } }))
        : null;
    const payeeId = seller?.id ?? userId;
    return this.db.$transaction(async (tx) => {
      await lock(tx, `${data.payeeType === 'BUYER' ? 'buyer' : 'seller'}:${payeeId}`);
      if (seller)
        ensure(
          (await tx.seller.findUnique({ where: { id: seller.id } }))?.status === 'ACTIVE',
          'Do‘kon faol emas',
        );
      const idempotencyKey = `${payeeId}:${data.idempotencyKey}`;
      const existing = await tx.payout.findUnique({ where: { idempotencyKey } });
      if (existing) {
        ensure(
          existing.payeeType === data.payeeType &&
            existing.amount.eq(data.amount) &&
            existing.provider === data.provider &&
            existing.destinationToken === data.destinationToken &&
            existing.destinationMasked === data.destinationMasked,
          'Idempotentlik kaliti boshqa so‘rov uchun ishlatilgan',
        );
        return existing;
      }
      ensure(
        (await this.ledger.spendable(tx, data.payeeType, payeeId)).gte(data.amount),
        'Yechish uchun mablag‘ yetarli emas',
      );
      return tx.payout.create({ data: { ...data, idempotencyKey, payeeId } });
    });
  }
  async decision(staffId: string, payoutId: string, approve: boolean, reason: string) {
    return this.db.$transaction(async (tx) => {
      await lock(tx, `payout:${payoutId}`);
      const p = required(await tx.payout.findUnique({ where: { id: payoutId } }));
      ensure(p.status === 'PENDING', 'So‘rov ko‘rib chiqilgan');
      if (approve) this.providers.payout(p.provider);
      const result = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: approve ? 'PROCESSING' : 'FAILED',
          approvedBy: staffId,
          failureReason: approve ? null : reason,
        },
      });
      await audit(
        tx,
        staffId,
        approve ? 'PAYOUT_APPROVED' : 'PAYOUT_REJECTED',
        'Payout',
        payoutId,
        { reason },
      );
      if (approve) await emit(tx, 'payout.send', { payoutId });
      return result;
    });
  }
  async send(payoutId: string) {
    const p = required(await this.db.payout.findUnique({ where: { id: payoutId } }));
    if (p.status !== 'PROCESSING' || p.providerRef) return;
    const result = await this.providers.payout(p.provider).transfer({
      idempotencyKey: p.id,
      amount: p.amount.toFixed(2),
      destinationToken: p.destinationToken,
    });
    await this.db.payout.update({ where: { id: p.id }, data: { providerRef: result.reference } });
  }
  async apply(payoutId: string, status: 'SUCCESS' | 'FAILED', bankFee: string) {
    const original = required(await this.db.payout.findUnique({ where: { id: payoutId } }));
    return this.db.$transaction(async (tx) => {
      await lock(tx, `${original.payeeType === 'BUYER' ? 'buyer' : 'seller'}:${original.payeeId}`);
      await lock(tx, `payout:${payoutId}`);
      const p = required(await tx.payout.findUnique({ where: { id: payoutId } }));
      if (p.status === 'SUCCESS' || p.status === 'FAILED') return p;
      ensure(p.status === 'PROCESSING' && p.providerRef, 'Payout jo‘natilmagan');
      const fee = p.payeeType === 'SELLER' ? money(bankFee) : zero();
      ensure(fee.gte(0), 'Bank xarajati manfiy');
      if (status === 'SUCCESS')
        await this.ledger.post(tx, `payout:${p.id}`, [
          {
            account: p.payeeType === 'SELLER' ? 'SELLER_AVAILABLE' : 'BUYER_CREDIT',
            ownerId: p.payeeId,
            direction: 'DEBIT',
            amount: p.amount,
          },
          { account: 'PLATFORM_BANK_FEE_EXPENSE', direction: 'DEBIT', amount: fee },
          { account: 'PLATFORM_CASH', direction: 'CREDIT', amount: p.amount.plus(fee) },
        ]);
      const result = await tx.payout.update({
        where: { id: p.id },
        data: {
          status,
          bankFeeAmount: fee,
          processedAt: new Date(),
          failureReason: status === 'FAILED' ? 'PROVIDER_REJECTED' : null,
        },
      });
      if (status === 'SUCCESS') {
        const userId =
          p.payeeType === 'BUYER'
            ? p.payeeId
            : required(await tx.seller.findUnique({ where: { id: p.payeeId } })).userId;
        await emit(tx, 'notification', {
          eventKey: `payout:${p.id}`,
          userId,
          eventType: 'PAYOUT_COMPLETED',
          payload: { amount: p.amount.toFixed(2) },
        });
      }
      return result;
    });
  }
  async poll() {
    await processPages(
      (after) =>
        this.db.payout.findMany({
          where: {
            status: 'PROCESSING',
            providerRef: { not: null },
            ...(after ? { id: { gt: after } } : {}),
          },
          take: 200,
          orderBy: { id: 'asc' },
        }),
      async (p) => {
        const r = await this.providers.payout(p.provider).status(p.providerRef!);
        if (r.status !== 'PENDING') await this.apply(p.id, r.status, r.bankFee);
      },
    );
  }
}
