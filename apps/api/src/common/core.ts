import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminActionType, Prisma } from '@prisma/client';
import { z } from 'zod';
export type Tx = Prisma.TransactionClient;
export const money = (value: Prisma.Decimal.Value) =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const zero = () => money(0);
export const amount = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/)
  .refine((v) => money(v).gte(0));
export const positiveAmount = amount.refine((v) => money(v).gt(0));
export const rate = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/)
  .refine((v) => money(v).gte(0) && money(v).lte(100));
export const id = z.string().uuid();
export const text = z.string().trim().min(1).max(5000);
export const localized = z.object({ uz: text, ru: text }).strict();
export const imageUrl = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) =>
      new URL(v).protocol === 'https:' ||
      (process.env.NODE_ENV !== 'production' &&
        new URL(v).protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(new URL(v).hostname)),
  );
export const phone = z.string().regex(/^\+998\d{9}$/);
export const page = z
  .object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
  return parsed.data;
}
export function required<T>(value: T | null | undefined, message = 'Topilmadi'): T {
  if (value === null || value === undefined) throw new NotFoundException(message);
  return value;
}
export function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new ConflictException(message);
}
// Transaction-scoped locks also protect rows that do not exist yet (OTP, new carts/accounts).
export async function lock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
export async function audit(
  tx: Tx,
  staffId: string,
  actionType: AdminActionType,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.adminActionLog.create({
    data: { staffId, actionType, targetType, targetId, metadata },
  });
}
export async function emit(tx: Tx, topic: string, payload: Prisma.InputJsonValue, priority = 5) {
  return tx.outboxEvent.create({ data: { topic, payload, priority } });
}
export const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3600000);
export function configuredHours(name: string): number {
  const value = Number(process.env[name]);
  ensure(Number.isFinite(value) && value > 0, `${name} sozlanmagan`);
  return value;
}
