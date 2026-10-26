import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Payout } from '@prisma/client';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions } from '../auth/access';
import { id, page, parse, positiveAmount, text } from '../common/core';
import { PrismaService } from '../prisma.service';
import { LedgerService } from './ledger.service';
import { PayoutsService } from './payouts.service';
export function publicPayout(p: Payout) {
  const { destinationToken: _secret, idempotencyKey: _key, ...result } = p;
  return result;
}
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly payouts: PayoutsService,
  ) {}
  @Get('mine') @Permissions('payouts:own') async mine(@CurrentActor() a: Actor) {
    return this.db.$transaction(async (tx) => ({
      buyerCredit: await this.ledger.balance(tx, 'BUYER_CREDIT', a.id),
      buyerSpendable: await this.ledger.spendable(tx, 'BUYER', a.id),
      ...(a.sellerId
        ? {
            sellerAvailable: await this.ledger.balance(tx, 'SELLER_AVAILABLE', a.sellerId),
            sellerFrozen: await this.ledger.balance(tx, 'SELLER_FROZEN', a.sellerId),
            sellerDeposit: await this.ledger.balance(tx, 'SELLER_DEPOSIT', a.sellerId),
            sellerSpendable: await this.ledger.spendable(tx, 'SELLER', a.sellerId),
          }
        : {}),
    }));
  }
  @Get('transactions') @Permissions('payouts:own') history(
    @CurrentActor() a: Actor,
    @Query() query: unknown,
  ) {
    return this.db.ledgerEntry.findMany({
      where: {
        OR: [
          { ownerId: a.id, account: 'BUYER_CREDIT' },
          ...(a.sellerId
            ? [
                {
                  ownerId: a.sellerId,
                  account: {
                    in: ['SELLER_AVAILABLE', 'SELLER_FROZEN', 'SELLER_DEPOSIT'] as (
                      | 'SELLER_AVAILABLE'
                      | 'SELLER_FROZEN'
                      | 'SELLER_DEPOSIT'
                    )[],
                  },
                },
              ]
            : []),
        ],
      },
      ...parse(page, query),
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('payouts') @Permissions('payouts:own') list(
    @CurrentActor() a: Actor,
    @Query() query: unknown,
  ) {
    return this.db.payout.findMany({
      where: {
        OR: [
          { payeeType: 'BUYER', payeeId: a.id },
          ...(a.sellerId ? [{ payeeType: 'SELLER' as const, payeeId: a.sellerId }] : []),
        ],
      },
      ...parse(page, query),
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        amount: true,
        status: true,
        destinationMasked: true,
        requestedAt: true,
        processedAt: true,
        failureReason: true,
      },
    });
  }
  @Post('payouts') @Permissions('payouts:own') async request(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    return publicPayout(
      await this.payouts.request(
        a.id,
        parse(
          z
            .object({
              payeeType: z.enum(['BUYER', 'SELLER']),
              amount: positiveAmount,
              provider: z.string().min(1).max(50),
              destinationToken: z
                .string()
                .min(10)
                .max(500)
                .refine((v) => !/^\d+$/.test(v)),
              destinationMasked: z.string().regex(/^\*{4}\d{4}$/),
              idempotencyKey: id,
            })
            .strict(),
          body,
        ),
      ),
    );
  }
  @Post('payouts/:id/decision') @Permissions('payouts:manage') async decision(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const d = parse(z.object({ approve: z.boolean(), reason: text }).strict(), body);
    return publicPayout(await this.payouts.decision(a.id, parse(id, value), d.approve, d.reason));
  }
}
