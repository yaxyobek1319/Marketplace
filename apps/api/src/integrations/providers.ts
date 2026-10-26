import { Injectable, ServiceUnavailableException } from '@nestjs/common';
// Provider adapters are explicit boundaries: no fabricated success when credentials/adapters are absent.
export abstract class SmsProvider {
  abstract send(phone: string, message: string, idempotencyKey: string): Promise<string>;
}
@Injectable()
export class UnconfiguredSmsProvider extends SmsProvider {
  async send(): Promise<string> {
    throw new ServiceUnavailableException('SMS provayder adapteri sozlanmagan');
  }
}
export interface PaymentResult {
  reference: string;
  amount: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
}
export abstract class PaymentProvider {
  abstract create(
    paymentId: string,
    amount: string,
  ): Promise<{ reference: string; redirectUrl: string }>;
  abstract status(reference: string): Promise<PaymentResult>;
  abstract cancel(reference: string): Promise<PaymentResult>;
  abstract verifyWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<PaymentResult & { eventId: string; paymentId: string }>;
}
export abstract class DeliveryProvider {
  abstract requestDelivery(input: {
    idempotencyKey: string;
    pickupAddress: string;
    dropoffAddress: string;
    recipientPhone: string;
    orderInfo: unknown;
  }): Promise<{ reference: string; trackingCode?: string; chargedAmount: string }>;
  abstract getStatus(reference: string): Promise<string>;
  abstract verifyWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
  ): Promise<{
    eventId: string;
    reference: string;
    status: import('@prisma/client').ShipmentStatus;
  }>;
  abstract cancelDelivery(reference: string): Promise<void>;
}
export abstract class PayoutProvider {
  abstract transfer(input: {
    idempotencyKey: string;
    amount: string;
    destinationToken: string;
  }): Promise<{ reference: string }>;
  abstract status(
    reference: string,
  ): Promise<{ status: 'PENDING' | 'SUCCESS' | 'FAILED'; bankFee: string }>;
}
@Injectable()
export class ProviderRegistry {
  readonly payments = new Map<string, PaymentProvider>();
  readonly deliveries = new Map<string, DeliveryProvider>();
  readonly payouts = new Map<string, PayoutProvider>();
  payment(name: string) {
    const p = this.payments.get(name);
    if (!p) throw new ServiceUnavailableException('To‘lov provayderi sozlanmagan');
    return p;
  }
  delivery(name: string) {
    const p = this.deliveries.get(name);
    if (!p) throw new ServiceUnavailableException('Yetkazish provayderi sozlanmagan');
    return p;
  }
  payout(name: string) {
    const p = this.payouts.get(name);
    if (!p) throw new ServiceUnavailableException('Payout provayderi sozlanmagan');
    return p;
  }
}
