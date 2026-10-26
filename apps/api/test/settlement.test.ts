import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService } from '../src/prisma.service';
import { OrdersService } from '../src/commerce/orders.service';
import { CartService } from '../src/commerce/cart.service';
import { LedgerService, Posting, validatePostings } from '../src/commerce/ledger.service';
import { ProviderRegistry } from '../src/integrations/providers';
import { money, Tx } from '../src/common/core';
import { OrderItem } from '@prisma/client';
function item(): OrderItem {
  return {
    id: 'item',
    orderId: 'order',
    sellerId: 'seller',
    variantId: 'variant',
    quantity: 2,
    priceAtPurchase: money(100),
    discountAmount: money(20),
    platformDiscountAmount: money(18),
    deliveryAmount: money(10),
    creditApplied: money(0),
    titleAtPurchase: { uz: 'A', ru: 'A' },
    appliedPromotionId: null,
    taxRateAtPurchase: money(12),
    taxAmount: money('21.60'),
    commissionRateAtPurchase: money(2),
    commissionAmount: money('3.60'),
    deliveryType: 'STANDARD',
    status: 'SHIPPED',
    confirmDeadline: null,
    autoConfirmAt: new Date(),
    completedAt: null,
    settledAmount: null,
    settledSubsidyAmount: null,
  };
}
test('settlement splits subsidy, tax and commission, and duplicate completion never increases sales', async () => {
  const record = item();
  let posts: Posting[] = [];
  let sales = 0;
  const tx = {
    $executeRaw: async () => 0,
    order: { findUnique: async () => ({ id: 'order', buyerId: 'buyer' }) },
    orderItem: {
      findFirst: async () => record,
      update: async ({ data }: any) => {
        Object.assign(record, data);
        return record;
      },
    },
    productVariant: {
      update: async ({ data }: any) => {
        sales += data.salesCount.increment;
      },
    },
  };
  const db = { $transaction: async (fn: any) => fn(tx) } as PrismaService;
  const ledger = {
    post: async (_: unknown, _id: string, entries: Posting[]) => {
      posts = entries;
      validatePostings(entries.filter((e) => money(e.amount).gt(0)));
    },
  } as unknown as LedgerService;
  const service = new OrdersService(db, {} as CartService, ledger, new ProviderRegistry());
  await service.complete('buyer', 'item');
  assert.equal(record.status, 'COMPLETED');
  assert.equal(sales, 2);
  assert.equal(
    money(posts.find((e) => e.account === 'SELLER_AVAILABLE')!.amount).toFixed(2),
    '154.80',
  );
  assert.equal(
    money(posts.find((e) => e.account === 'PLATFORM_TAX_PAYABLE')!.amount).toFixed(2),
    '21.60',
  );
  await assert.rejects(service.complete('buyer', 'item'), /Faqat/);
  assert.equal(sales, 2);
});
test('partial dispute reverses proportional subsidy without paying it to buyer', async () => {
  const record = item();
  let posts: Posting[] = [];
  const tx = {
    $executeRaw: async () => 0,
    order: { findUnique: async () => ({ buyerId: 'buyer' }) },
    productVariant: { update: async () => ({}) },
    orderItem: { update: async ({ data }: any) => Object.assign(record, data) },
  } as unknown as Tx;
  const ledger = {
    post: async (_: unknown, _id: string, entries: Posting[]) => {
      posts = entries;
      validatePostings(entries.filter((e) => money(e.amount).gt(0)));
    },
  } as unknown as LedgerService;
  const service = new OrdersService(
    {} as PrismaService,
    {} as CartService,
    ledger,
    new ProviderRegistry(),
  );
  await service.settle(tx, record, money(81));
  assert.equal(record.settledAmount!.toFixed(2), '90.00');
  assert.equal(record.settledSubsidyAmount!.toFixed(2), '9.00');
  assert.equal(money(posts.find((e) => e.account === 'BUYER_CREDIT')!.amount).toFixed(2), '81.00');
  assert.equal(
    money(posts.find((e) => e.account === 'PLATFORM_SUBSIDY_EXPENSE')!.amount).toFixed(2),
    '9.00',
  );
});

test('spendable balances subtract both pending payouts and pending checkout credit', async () => {
  const tx = {
    ledgerEntry: {
      groupBy: async () => [
        { direction: 'CREDIT', _sum: { amount: money(100) } },
        { direction: 'DEBIT', _sum: { amount: money(10) } },
      ],
    },
    payout: { aggregate: async () => ({ _sum: { amount: money(20) } }) },
    order: { aggregate: async () => ({ _sum: { creditApplied: money(30) } }) },
  } as unknown as Tx;
  assert.equal((await new LedgerService().spendable(tx, 'BUYER', 'buyer')).toFixed(2), '40.00');
});
