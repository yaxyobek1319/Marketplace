import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processPages } from '../src/common/batch';
import { NotificationsService } from '../src/operations/notifications.service';
import { publicPayout } from '../src/commerce/payouts.controller';

test('a failing provider does not starve subsequent records or later pages', async () => {
  const processed: string[] = [];
  const data = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  await assert.rejects(
    processPages(
      async (after) => data.filter((v) => !after || v.id > after).slice(0, 2),
      async (item) => {
        processed.push(item.id);
        if (item.id === 'a' || item.id === 'c') throw new Error('private provider payload');
      },
    ),
    (error) => {
      assert.equal((error as Error).message, '2 batch item(s) failed; retry required');
      return true;
    },
  );
  assert.deepEqual(processed, ['a', 'b', 'c', 'd']);
});
test('critical SMS fallback waits for all free retries and is created once', async () => {
  const push = {
    id: 'push',
    eventKey: 'event',
    userId: 'u',
    eventType: 'DISPUTE_OPENED',
    channel: 'PUSH',
    status: 'FAILED',
    exhaustedAt: null as Date | null,
    payload: {},
  };
  const telegram = { ...push, id: 'telegram', channel: 'TELEGRAM' };
  const rows = [push, telegram];
  const events: unknown[] = [];
  const tx = {
    $executeRaw: async () => 1,
    notification: {
      findUnique: async ({ where }: any) =>
        where.id
          ? rows.find((v) => v.id === where.id)
          : rows.find((v) => v.channel === where.eventKey_userId_channel.channel),
      findMany: async () => rows.filter((v) => v.channel !== 'SMS'),
      update: async ({ where, data }: any) =>
        Object.assign(rows.find((v) => v.id === where.id)!, data),
      create: async ({ data }: any) => {
        const n = { id: 'sms', status: 'PENDING', exhaustedAt: null, ...data };
        rows.push(n);
        return n;
      },
    },
    notificationTemplate: { findUnique: async () => ({ critical: true }) },
    outboxEvent: { create: async (v: unknown) => events.push(v) },
  };
  const db = { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) };
  const service = new NotificationsService(db as never, {} as never, {} as never);
  await service.exhausted('push');
  assert.equal(events.length, 0);
  await service.exhausted('telegram');
  assert.equal(events.length, 1);
  assert.equal(rows.filter((v) => v.channel === 'SMS').length, 1);
  await service.exhausted('push');
  assert.equal(events.length, 1);
});
test('a successful free notification prevents SMS fallback', async () => {
  let creates = 0;
  const row = {
    id: 'p',
    eventKey: 'e',
    userId: 'u',
    eventType: 'DISPUTE_OPENED',
    channel: 'PUSH',
    status: 'FAILED',
  };
  const tx = {
    $executeRaw: async () => 1,
    notification: {
      findUnique: async () => row,
      update: async () => row,
      findMany: async () => [
        { status: 'SENT', exhaustedAt: null },
        { status: 'FAILED', exhaustedAt: new Date() },
      ],
      create: async () => {
        creates++;
      },
    },
    notificationTemplate: { findUnique: async () => ({ critical: true }) },
  };
  const service = new NotificationsService(
    { $transaction: async (fn: any) => fn(tx) } as never,
    {} as never,
    {} as never,
  );
  await service.exhausted('p');
  assert.equal(creates, 0);
});
test('marketing opt-out does not suppress transactional order updates', async () => {
  const channels: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({
        marketingEnabled: false,
        pushTokens: [{ id: 'device' }],
        telegramChatId: null,
      }),
    },
    notificationTemplate: { findUnique: async () => ({ critical: false }) },
    notification: {
      upsert: async ({ create }: any) => {
        channels.push(create.channel);
        return { id: 'n', status: 'SENT' };
      },
    },
  };
  const service = new NotificationsService(
    { $transaction: async (fn: any) => fn(tx) } as never,
    {} as never,
    {} as never,
  );
  await service.enqueue('shipping', 'user', 'ORDER_SHIPPED', {});
  assert.deepEqual(channels, ['PUSH']);
  await service.enqueue('promotion', 'user', 'PROMOTION_REMINDER', {});
  assert.deepEqual(channels, ['PUSH']);
});
test('payout responses exclude destination token and internal replay key', () => {
  assert.deepEqual(
    publicPayout({
      id: 'p',
      amount: '100',
      destinationToken: 'secret-token',
      idempotencyKey: 'key',
    } as never),
    { id: 'p', amount: '100' },
  );
});
