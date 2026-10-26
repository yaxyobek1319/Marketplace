import { Injectable } from '@nestjs/common';
import { LedgerAccountType, LedgerDirection, Prisma } from '@prisma/client';
import { ensure, lock, money, Tx, zero } from '../common/core';
export interface Posting {
  account: LedgerAccountType;
  ownerId?: string;
  direction: LedgerDirection;
  amount: Prisma.Decimal.Value;
  orderId?: string;
  orderItemId?: string;
}
export function validatePostings(postings: Posting[]) {
  ensure(postings.length >= 2, 'Ledger uchun kamida ikki yozuv kerak');
  let balance = zero();
  for (const p of postings) {
    const value = new Prisma.Decimal(p.amount);
    ensure(
      value.isFinite() && value.gt(0) && value.decimalPlaces() <= 2,
      'Ledger miqdori noto‘g‘ri',
    );
    ensure(
      !['SELLER_FROZEN', 'SELLER_AVAILABLE', 'SELLER_DEPOSIT', 'BUYER_CREDIT'].includes(
        p.account,
      ) || p.ownerId,
      'Hisob egasi majburiy',
    );
    balance = p.direction === 'DEBIT' ? balance.plus(value) : balance.minus(value);
  }
  ensure(balance.eq(0), 'Ledger debet/kredit yig‘indisi teng emas');
}
@Injectable()
export class LedgerService {
  async post(tx: Tx, groupId: string, input: Posting[]) {
    for (const entry of input) {
      const value = new Prisma.Decimal(entry.amount);
      ensure(
        value.isFinite() && value.gte(0) && value.decimalPlaces() <= 2,
        'Ledger miqdori noto‘g‘ri',
      );
    }
    const postings = input.filter((p) => new Prisma.Decimal(p.amount).gt(0));
    if (!postings.length) return false;
    validatePostings(postings);
    await lock(tx, `ledger:${groupId}`);
    if (await tx.ledgerGroup.findUnique({ where: { id: groupId } })) return false;
    await tx.ledgerGroup.create({ data: { id: groupId } });
    await tx.ledgerEntry.createMany({
      data: postings.map((p) => ({ ...p, amount: money(p.amount), groupId })),
    });
    return true;
  }
  async balance(tx: Tx, account: LedgerAccountType, ownerId: string) {
    const sums = await tx.ledgerEntry.groupBy({
      by: ['direction'],
      where: { account, ownerId },
      _sum: { amount: true },
    });
    const debit = sums.find((s) => s.direction === 'DEBIT')?._sum.amount ?? zero();
    const credit = sums.find((s) => s.direction === 'CREDIT')?._sum.amount ?? zero();
    return credit.minus(debit);
  }
  async spendable(tx: Tx, type: 'BUYER' | 'SELLER', ownerId: string, excludeReturnId?: string) {
    const balance = await this.balance(
      tx,
      type === 'BUYER' ? 'BUYER_CREDIT' : 'SELLER_AVAILABLE',
      ownerId,
    );
    const payouts = await tx.payout.aggregate({
      where: { payeeType: type, payeeId: ownerId, status: { in: ['PENDING', 'PROCESSING'] } },
      _sum: { amount: true },
    });
    const orders =
      type === 'BUYER'
        ? ((
            await tx.order.aggregate({
              where: { buyerId: ownerId, paymentStatus: 'PENDING' },
              _sum: { creditApplied: true },
            })
          )._sum.creditApplied ?? zero())
        : zero();
    const returns =
      type === 'SELLER'
        ? await tx.returnRequest.findMany({
            where: {
              id: excludeReturnId ? { not: excludeReturnId } : undefined,
              status: { in: ['REQUESTED', 'APPROVED', 'ITEM_RECEIVED'] },
              orderItem: { sellerId: ownerId },
            },
            include: { orderItem: true },
          })
        : [];
    const reserved = returns.reduce(
      (sum, r) =>
        sum.plus(
          (r.orderItem.settledAmount ?? zero())
            .minus(r.orderItem.taxAmount)
            .minus(r.orderItem.commissionAmount),
        ),
      zero(),
    );
    return balance
      .minus(payouts._sum.amount ?? zero())
      .minus(orders)
      .minus(reserved);
  }
}
