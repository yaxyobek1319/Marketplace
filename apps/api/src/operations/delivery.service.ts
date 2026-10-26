import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProviderRegistry } from '../integrations/providers';
import {
  audit,
  configuredHours,
  emit,
  ensure,
  hoursFromNow,
  lock,
  money,
  required,
} from '../common/core';
import { LedgerService } from '../commerce/ledger.service';
@Injectable()
export class DeliveryService {
  constructor(
    private readonly db: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly ledger: LedgerService,
  ) {}
  async failed(shipmentId: string) {
    const s = await this.db.shipment.findUnique({ where: { id: shipmentId } });
    if (!s) return;
    await this.db.$transaction(async (tx) => {
      await lock(tx, `item:${s.orderItemId}`);
      await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          providerRef: null,
          status: { in: ['AWAITING_DISPATCH', 'BATCHED'] },
        },
        data: { status: 'FAILED' },
      });
    });
  }
  async retry(staffId: string, shipmentId: string) {
    return this.db.$transaction(async (tx) => {
      const s = required(await tx.shipment.findUnique({ where: { id: shipmentId } }));
      await lock(tx, `item:${s.orderItemId}`);
      const current = required(
        await tx.shipment.findUnique({ where: { id: shipmentId }, include: { orderItem: true } }),
      );
      ensure(
        current.status === 'FAILED' &&
          !current.providerRef &&
          current.orderItem.status === 'CONFIRMED',
        'Faqat provayderga biriktirilmagan jo‘natmani qayta yuborish mumkin',
      );
      const result = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: 'BATCHED' },
      });
      await emit(tx, 'delivery.dispatch', { shipmentId });
      await audit(tx, staffId, 'DELIVERY_RETRIED', 'Shipment', shipmentId, {});
      return result;
    });
  }
  async ready(userId: string, itemId: string) {
    const provider = process.env.DELIVERY_PROVIDER;
    ensure(provider, 'Yetkazish provayderi tanlanmagan');
    this.providers.delivery(provider);
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${itemId}`);
      const item = required(
        await tx.orderItem.findFirst({
          where: {
            id: itemId,
            order: { paymentStatus: 'PAID' },
            variant: { product: { seller: { userId, status: 'ACTIVE' } } },
          },
          include: {
            order: true,
            variant: { include: { product: { include: { seller: true } } } },
            shipment: true,
          },
        }),
      );
      if (item.shipment) return item.shipment;
      ensure(item.status === 'CONFIRMED', 'Buyurtma tasdiqlanmagan');
      const address = item.order.deliveryAddress as {
        address: string;
        recipientPhone: string;
        region: string;
      };
      const pickupAddress = required(
        item.variant.product.seller.pickupAddress,
        'Do‘kon manzili belgilanmagan',
      );
      const s = await tx.shipment.create({
        data: {
          orderItemId: itemId,
          provider,
          pickupAddress,
          recipientAddress: address.address,
          recipientPhone: address.recipientPhone,
          region: address.region,
          scheduledDispatchAt: item.deliveryType === 'FREE' ? hoursFromNow(48) : new Date(),
        },
      });
      if (item.deliveryType !== 'FREE') await emit(tx, 'delivery.dispatch', { shipmentId: s.id });
      return s;
    });
  }
  async dispatch(shipmentId: string) {
    const s = required(
      await this.db.shipment.findUnique({
        where: { id: shipmentId },
        include: { orderItem: true },
      }),
    );
    if (
      !!s.providerRef ||
      !['AWAITING_DISPATCH', 'BATCHED', 'FAILED'].includes(s.status) ||
      s.orderItem.status !== 'CONFIRMED'
    )
      return;
    const result = await this.providers.delivery(s.provider!).requestDelivery({
      idempotencyKey: s.id,
      pickupAddress: s.pickupAddress,
      dropoffAddress: s.recipientAddress,
      recipientPhone: s.recipientPhone,
      orderInfo: {
        orderItemId: s.orderItemId,
        quantity: s.orderItem.quantity,
        batchGroupId: s.batchGroupId,
      },
    });
    ensure(money(result.chargedAmount).gte(0), 'Yetkazish xarajati noto‘g‘ri');
    await this.db.$transaction(async (tx) => {
      await lock(tx, `item:${s.orderItemId}`);
      const current = required(await tx.shipment.findUnique({ where: { id: s.id } }));
      if (current.providerRef) return;
      await tx.shipment.update({
        where: { id: s.id },
        data: {
          providerRef: result.reference,
          trackingCode: result.trackingCode,
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
        },
      });
      await tx.orderItem.update({ where: { id: s.orderItemId }, data: { status: 'SHIPPED' } });
      if (money(result.chargedAmount).gt(0))
        await this.ledger.post(tx, `delivery:${s.id}`, [
          {
            account: 'PLATFORM_SUBSIDY_EXPENSE',
            direction: 'DEBIT',
            amount: result.chargedAmount,
            orderItemId: s.orderItemId,
          },
          {
            account: 'PLATFORM_CASH',
            direction: 'CREDIT',
            amount: result.chargedAmount,
            orderItemId: s.orderItemId,
          },
        ]);
      const order = required(await tx.order.findUnique({ where: { id: s.orderItem.orderId } }));
      await emit(tx, 'notification', {
        eventKey: `shipment:${s.id}`,
        userId: order.buyerId,
        eventType: 'ORDER_SHIPPED',
        payload: { orderItemId: s.orderItemId },
      });
    });
  }
  async webhook(provider: string, headers: Record<string, string>, body: Buffer) {
    const r = await this.providers.delivery(provider).verifyWebhook(headers, body);
    return this.update(provider, r.eventId, r.reference, r.status);
  }
  async update(provider: string, eventId: string, reference: string, status: ShipmentStatus) {
    const s = required(
      await this.db.shipment.findFirst({ where: { provider, providerRef: reference } }),
    );
    return this.db.$transaction(async (tx) => {
      await lock(tx, `item:${s.orderItemId}`);
      const prior = await tx.deliveryWebhookEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId: eventId } },
      });
      if (prior) return { accepted: true };
      const current = required(
        await tx.shipment.findUnique({ where: { id: s.id }, include: { orderItem: true } }),
      );
      const ranks: Record<string, number> = {
        AWAITING_DISPATCH: 0,
        BATCHED: 1,
        DISPATCHED: 2,
        IN_TRANSIT: 3,
        FAILED: 3,
        DELIVERED: 4,
      };
      if (ranks[status] >= ranks[current.status] && current.status !== 'DELIVERED') {
        await tx.shipment.update({
          where: { id: s.id },
          data: { status, deliveredAt: status === 'DELIVERED' ? new Date() : undefined },
        });
        if (status === 'DELIVERED' && current.orderItem.status === 'SHIPPED')
          await tx.orderItem.update({
            where: { id: s.orderItemId },
            data: { autoConfirmAt: hoursFromNow(configuredHours('AUTO_CONFIRM_HOURS')) },
          });
      }
      await tx.deliveryWebhookEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          payload: { reference, status },
          processedAt: new Date(),
        },
      });
      return { accepted: true };
    });
  }
  async batch() {
    const waiting = await this.db.shipment.findMany({
      where: { status: 'AWAITING_DISPATCH', orderItem: { status: 'CONFIRMED' } },
      take: 500,
      orderBy: { createdAt: 'asc' },
    });
    for (const s of waiting) {
      const peers = waiting.filter((v) => v.region === s.region && v.provider === s.provider);
      if (peers.length < 2 && (!s.scheduledDispatchAt || s.scheduledDispatchAt > new Date()))
        continue;
      await this.db.$transaction(async (tx) => {
        await lock(tx, `item:${s.orderItemId}`);
        const current = required(await tx.shipment.findUnique({ where: { id: s.id } }));
        if (current.status !== 'AWAITING_DISPATCH') return;
        await tx.shipment.update({
          where: { id: s.id },
          data: { status: 'BATCHED', batchGroupId: peers.length > 1 ? peers[0].id : null },
        });
        await emit(tx, 'delivery.dispatch', { shipmentId: s.id });
      });
    }
  }
}
