import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { NotificationChannel, NotificationEventType, Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { digest, newToken } from '../auth/security';
import { emit, ensure, lock, required } from '../common/core';
import { SmsProvider } from '../integrations/providers';
export function notificationChannels(
  critical: boolean,
  marketingEnabled: boolean,
  push: boolean,
  telegram: boolean,
): NotificationChannel[] {
  if (!critical && !marketingEnabled) return [];
  const channels: NotificationChannel[] = [];
  if (push) channels.push('PUSH');
  if (telegram) channels.push('TELEGRAM');
  if (critical && !channels.length) channels.push('SMS');
  return channels;
}
export abstract class PushProvider {
  abstract send(
    token: string,
    message: string,
    idempotencyKey: string,
  ): Promise<{ reference: string; invalidToken?: boolean }>;
}
@Injectable()
export class UnconfiguredPushProvider extends PushProvider {
  async send(): Promise<{ reference: string }> {
    throw new ServiceUnavailableException('Push adapteri sozlanmagan');
  }
}
@Injectable()
export class NotificationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly sms: SmsProvider,
    private readonly push: PushProvider,
  ) {}
  async enqueue(
    eventKey: string,
    userId: string,
    eventType: NotificationEventType,
    payload: Prisma.InputJsonValue,
  ) {
    return this.db.$transaction(async (tx) => {
      const user = required(
        await tx.user.findUnique({
          where: { id: userId },
          include: { pushTokens: { where: { isActive: true } } },
        }),
      );
      const template = required(
        await tx.notificationTemplate.findUnique({ where: { eventType } }),
        'Bildirishnoma shabloni topilmadi',
      );
      for (const channel of notificationChannels(
        template.critical,
        eventType !== 'PROMOTION_REMINDER' || user.marketingEnabled,
        user.pushTokens.length > 0,
        !!user.telegramChatId,
      )) {
        const n = await tx.notification.upsert({
          where: { eventKey_userId_channel: { eventKey, userId, channel } },
          create: { eventKey, userId, eventType, channel, payload },
          update: {},
        });
        if (n.status !== 'SENT') await emit(tx, 'notification.send', { notificationId: n.id });
      }
    });
  }
  async send(notificationId: string) {
    const n = required(await this.db.notification.findUnique({ where: { id: notificationId } }));
    if (n.status === 'SENT' || n.status === 'SKIPPED' || n.exhaustedAt) return;
    const user = required(
      await this.db.user.findUnique({
        where: { id: n.userId },
        include: { pushTokens: { where: { isActive: true } } },
      }),
    );
    const template = required(
      await this.db.notificationTemplate.findUnique({ where: { eventType: n.eventType } }),
    );
    if (n.eventType === 'PROMOTION_REMINDER' && !user.marketingEnabled) {
      await this.db.notification.update({ where: { id: n.id }, data: { status: 'SKIPPED' } });
      return;
    }
    const localized = template.bodyI18n as Record<string, string>;
    const values = n.payload as Record<string, unknown>;
    const message = (localized[user.locale] ?? localized.uz).replace(/\{(\w+)\}/g, (_, key) =>
      String(values[key] ?? ''),
    );
    try {
      let reference: string | undefined;
      if (n.channel === 'SMS') reference = await this.sms.send(user.phone, message, n.id);
      if (n.channel === 'PUSH') {
        ensure(user.pushTokens.length, 'Faol push token yo‘q');
        for (const token of user.pushTokens) {
          const r = await this.push.send(token.token, message, `${n.id}:${token.id}`);
          if (r.invalidToken)
            await this.db.pushToken.update({ where: { id: token.id }, data: { isActive: false } });
          else reference = r.reference;
        }
        ensure(reference, 'Push yetkazilmadi');
      }
      if (n.channel === 'TELEGRAM') {
        ensure(user.telegramChatId, 'Telegram ulanmagan');
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) throw new ServiceUnavailableException('Telegram sozlanmagan');
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: user.telegramChatId, text: message }),
          signal: AbortSignal.timeout(10000),
        });
        const result = (await response.json()) as {
          ok: boolean;
          error_code?: number;
          result?: { message_id: number };
        };
        if (!result.ok) {
          if (result.error_code === 403 || result.error_code === 400)
            await this.db.user.update({ where: { id: user.id }, data: { telegramChatId: null } });
          throw new Error('Telegram delivery failed');
        }
        reference = String(result.result!.message_id);
      }
      await this.db.notification.update({
        where: { id: n.id },
        data: { status: 'SENT', sentAt: new Date(), providerRef: reference },
      });
    } catch (error) {
      await this.db.notification.update({ where: { id: n.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }
  async exhausted(notificationId: string) {
    await this.db.$transaction(async (tx) => {
      const original = required(
        await tx.notification.findUnique({ where: { id: notificationId } }),
      );
      await lock(tx, `notification-event:${original.eventKey}:${original.userId}`);
      const current = required(await tx.notification.findUnique({ where: { id: notificationId } }));
      if (current.status === 'SENT' || current.status === 'SKIPPED') return;
      await tx.notification.update({
        where: { id: notificationId },
        data: { status: 'FAILED', exhaustedAt: new Date() },
      });
      if (current.channel === 'SMS') return;
      const template = required(
        await tx.notificationTemplate.findUnique({ where: { eventType: current.eventType } }),
      );
      if (!template.critical) return;
      const free = await tx.notification.findMany({
        where: {
          eventKey: current.eventKey,
          userId: current.userId,
          channel: { in: ['PUSH', 'TELEGRAM'] },
        },
      });
      if (free.some((n) => n.status === 'SENT' || !n.exhaustedAt)) return;
      const key = { eventKey: current.eventKey, userId: current.userId, channel: 'SMS' as const };
      if (await tx.notification.findUnique({ where: { eventKey_userId_channel: key } })) return;
      const fallback = await tx.notification.create({
        data: {
          ...key,
          eventType: current.eventType,
          payload: current.payload as Prisma.InputJsonValue,
        },
      });
      await emit(tx, 'notification.send', { notificationId: fallback.id });
    });
  }
  async link(userId: string) {
    const bot = process.env.TELEGRAM_BOT_USERNAME;
    ensure(bot && /^[A-Za-z0-9_]+$/.test(bot), 'Telegram bot nomi sozlanmagan');
    const token = newToken();
    await this.db.telegramLinkToken.create({
      data: { userId, token: digest(token), expiresAt: new Date(Date.now() + 600000) },
    });
    return { url: `https://t.me/${bot}?start=${token}`, expiresIn: 600 };
  }
  async bind(
    secret: string | undefined,
    body: { message?: { chat: { id: number; type?: string }; text?: string } },
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (
      !expected ||
      !secret ||
      Buffer.byteLength(expected) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(secret))
    )
      throw new UnauthorizedException();
    const token = body.message?.text?.match(/^\/start ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token || body.message?.chat.type !== 'private') return { accepted: true };
    return this.db.$transaction(async (tx) => {
      await lock(tx, `telegram:${digest(token)}`);
      const link = await tx.telegramLinkToken.findUnique({ where: { token: digest(token) } });
      if (!link || link.consumedAt || link.expiresAt <= new Date()) return { accepted: true };
      const telegramChatId = String(body.message!.chat.id);
      await lock(tx, `telegram-chat:${telegramChatId}`);
      await tx.user.updateMany({ where: { telegramChatId }, data: { telegramChatId: null } });
      await tx.user.update({ where: { id: link.userId }, data: { telegramChatId } });
      await tx.telegramLinkToken.update({
        where: { id: link.id },
        data: { consumedAt: new Date() },
      });
      return { accepted: true };
    });
  }
}
