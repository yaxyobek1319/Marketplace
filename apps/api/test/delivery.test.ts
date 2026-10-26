import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeliveryService } from '../src/operations/delivery.service';

test('assigned failed shipment never requests a second courier', async () => {
  let requests = 0;
  const db = {
    shipment: {
      findUnique: async () => ({
        id: 's',
        providerRef: 'assigned',
        status: 'FAILED',
        orderItem: { status: 'CONFIRMED' },
      }),
    },
  };
  const providers = {
    delivery: () => ({
      requestDelivery: async () => {
        requests++;
      },
    }),
  };
  const service = new DeliveryService(db as never, providers as never, {} as never);
  await service.dispatch('s');
  assert.equal(requests, 0);
});
test('operator retries only unassigned failures and writes audit with outbox atomically', async () => {
  const shipment = {
    id: 's',
    orderItemId: 'i',
    status: 'FAILED',
    providerRef: null as string | null,
    orderItem: { status: 'CONFIRMED' },
  };
  const events: unknown[] = [],
    audits: unknown[] = [];
  const tx = {
    $executeRaw: async () => 1,
    shipment: {
      findUnique: async () => shipment,
      update: async ({ data }: { data: { status: string } }) => Object.assign(shipment, data),
    },
    outboxEvent: { create: async (v: unknown) => events.push(v) },
    adminActionLog: { create: async (v: unknown) => audits.push(v) },
  };
  const db = { $transaction: async (fn: (tx: unknown) => unknown) => fn(tx) };
  const service = new DeliveryService(db as never, {} as never, {} as never);
  await service.retry('staff', 's');
  assert.equal(shipment.status, 'BATCHED');
  assert.equal(events.length, 1);
  assert.equal(audits.length, 1);
  await assert.rejects(service.retry('staff', 's'));
  assert.equal(events.length, 1);
  shipment.status = 'FAILED';
  shipment.providerRef = 'external';
  await assert.rejects(service.retry('staff', 's'));
  assert.equal(events.length, 1);
});
