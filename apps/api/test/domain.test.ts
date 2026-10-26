import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, Promotion } from '@prisma/client';
import { allocate, promotionDiscount } from '../src/commerce/pricing';
import { validatePostings } from '../src/commerce/ledger.service';
import { money } from '../src/common/core';
import { notificationChannels } from '../src/operations/notifications.service';
import { orderStatus } from '../src/commerce/order-status';
import { decrypt, encrypt, hashSecret, verifySecret } from '../src/auth/security';
test('discount allocation conserves every cent across mixed seller lines', () => {
  for (let total = 0; total <= 100; total++) {
    const weights = [money('0.33'), money('0.33'), money('0.34')];
    const parts = allocate(money(total / 100), weights);
    assert.equal(
      parts.reduce((s, p) => s.plus(p), money(0)).toFixed(2),
      money(total / 100).toFixed(2),
    );
    parts.forEach((p, i) => assert.ok(p.gte(0) && p.lte(weights[i])));
  }
  assert.deepEqual(allocate(money('0.01'), [money(1), money(1), money(1)]).map(String), [
    '0.01',
    '0',
    '0',
  ]);
  assert.throws(() => allocate(money(2), [money(1)]));
});
test('promotion respects threshold, coupon, first purchase and date', () => {
  const p: Promotion = {
    id: 'p',
    scope: 'SELLER',
    sellerId: 's',
    minAmount: money(100),
    discountPercent: money(10),
    fixedAmount: null,
    isActive: true,
    startAt: null,
    endAt: null,
    couponCode: 'FIRST',
    firstPurchaseOnly: true,
  };
  assert.equal(promotionDiscount(p, money(99), true, 'FIRST').toString(), '0');
  assert.equal(promotionDiscount(p, money(100), false, 'FIRST').toString(), '0');
  assert.equal(promotionDiscount(p, money(100), true, 'WRONG').toString(), '0');
  assert.equal(promotionDiscount(p, money(100), true, 'FIRST').toString(), '10');
  assert.equal(
    promotionDiscount({ ...p, endAt: new Date(0) }, money(100), true, 'FIRST').toString(),
    '0',
  );
});
test('ledger rejects imbalance, precision loss, missing ownership and negative amounts', () => {
  validatePostings([
    { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: '10.25' },
    { account: 'SELLER_FROZEN', ownerId: 'seller', direction: 'CREDIT', amount: '10.25' },
  ]);
  assert.throws(() =>
    validatePostings([
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: 10 },
      { account: 'SELLER_FROZEN', ownerId: 'seller', direction: 'CREDIT', amount: 9 },
    ]),
  );
  assert.throws(() =>
    validatePostings([
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: '1.001' },
      { account: 'SELLER_FROZEN', ownerId: 'seller', direction: 'CREDIT', amount: '1.001' },
    ]),
  );
  assert.throws(() =>
    validatePostings([
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: 1 },
      { account: 'BUYER_CREDIT', direction: 'CREDIT', amount: 1 },
    ]),
  );
  assert.throws(() =>
    validatePostings([
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: -1 },
      { account: 'BUYER_CREDIT', ownerId: 'b', direction: 'CREDIT', amount: -1 },
    ]),
  );
});
test('SMS is critical-only fallback; free channels fan out; marketing opt-out is respected', () => {
  assert.deepEqual(notificationChannels(true, true, true, true), ['PUSH', 'TELEGRAM']);
  assert.deepEqual(notificationChannels(true, false, false, false), ['SMS']);
  assert.deepEqual(notificationChannels(false, true, false, false), []);
  assert.deepEqual(notificationChannels(false, false, true, true), []);
  assert.deepEqual(notificationChannels(false, true, false, true), ['TELEGRAM']);
});
test('aggregate order status handles mixed sellers', () => {
  assert.equal(orderStatus(['COMPLETED', 'CANCELLED']), 'CLOSED');
  assert.equal(orderStatus(['COMPLETED', 'DISPUTED']), 'ATTENTION_REQUIRED');
  assert.equal(orderStatus(['COMPLETED', 'SHIPPED']), 'IN_PROGRESS');
});
test('password hashes are salted and encryption rejects tampering', async () => {
  const first = await hashSecret('correct horse battery staple'),
    second = await hashSecret('correct horse battery staple');
  assert.notEqual(first, second);
  assert.equal(await verifySecret('correct horse battery staple', first), true);
  assert.equal(await verifySecret('wrong', first), false);
  process.env.SECRET_ENCRYPTION_KEY = 'ab'.repeat(32);
  const ciphertext = encrypt('JBSWY3DPEHPK3PXP');
  assert.equal(decrypt(ciphertext), 'JBSWY3DPEHPK3PXP');
  const parts = ciphertext.split(':');
  parts[1] = '00'.repeat(16);
  assert.throws(() => decrypt(parts.join(':')));
});

test('ledger service never silently drops negative or over-precision postings', async () => {
  const { LedgerService } = await import('../src/commerce/ledger.service');
  const service = new LedgerService();
  const tx = {} as import('../src/common/core').Tx;
  await assert.rejects(
    service.post(tx, 'invalid', [
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: '-1.00' },
      { account: 'PLATFORM_COMMISSION_REVENUE', direction: 'CREDIT', amount: '-1.00' },
    ]),
  );
  await assert.rejects(
    service.post(tx, 'invalid', [
      { account: 'PLATFORM_CASH', direction: 'DEBIT', amount: '1.001' },
      { account: 'PLATFORM_COMMISSION_REVENUE', direction: 'CREDIT', amount: '1.001' },
    ]),
  );
});

test('public image upload accepts image signatures and rejects HTML/SVG payloads', async () => {
  const { imageExtension } = await import('../src/catalog/media.controller');
  assert.equal(imageExtension(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(imageExtension(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(imageExtension(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'png');
});
