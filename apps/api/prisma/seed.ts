import 'dotenv/config';
import { PrismaClient, NotificationEventType } from '@prisma/client';
const db = new PrismaClient();
async function seed() {
  for (const [minProductCount, depositAmount] of [
    [0, '500000.00'],
    [20, '1000000.00'],
  ] as const)
    await db.depositTier.upsert({
      where: { minProductCount },
      create: { minProductCount, depositAmount },
      update: {},
    });
  const templates: Record<NotificationEventType, { uz: string; ru: string }> = {
    SELLER_CONFIRMATION_NEEDED: {
      uz: 'Yangi buyurtma: {orderId}. Tasdiqlashingizni kutmoqda.',
      ru: 'Новый заказ: {orderId}. Ожидает подтверждения.',
    },
    ORDER_SHIPPED: {
      uz: 'Xaridingiz jo‘natildi: {orderItemId}.',
      ru: 'Ваш товар отправлен: {orderItemId}.',
    },
    DISPUTE_OPENED: {
      uz: 'Xarid bo‘yicha nizo ochildi: {orderItemId}. Javob yuboring.',
      ru: 'Открыт спор по товару: {orderItemId}. Отправьте ответ.',
    },
    DISPUTE_RESOLVED: {
      uz: 'Nizo bo‘yicha qaror chiqarildi: {disputeId}.',
      ru: 'Принято решение по спору: {disputeId}.',
    },
    PAYOUT_COMPLETED: {
      uz: 'Pul chiqarildi: {amount} so‘m.',
      ru: 'Перевод выполнен: {amount} сум.',
    },
    PROMOTION_REMINDER: { uz: 'Do‘kon taklifi: {message}', ru: 'Предложение магазина: {message}' },
  };
  for (const [eventType, bodyI18n] of Object.entries(templates))
    await db.notificationTemplate.upsert({
      where: { eventType: eventType as NotificationEventType },
      create: {
        eventType: eventType as NotificationEventType,
        bodyI18n,
        critical: !['ORDER_SHIPPED', 'PROMOTION_REMINDER'].includes(eventType),
      },
      update: {},
    });
}
seed().finally(() => db.$disconnect());
