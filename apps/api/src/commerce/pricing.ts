import { Prisma, Promotion } from '@prisma/client';
import { ensure, money, zero } from '../common/core';
export function allocate(total: Prisma.Decimal, weights: Prisma.Decimal[]): Prisma.Decimal[] {
  const sum = weights.reduce((s, w) => s.plus(w), zero());
  ensure(total.gte(0) && total.lte(sum), 'Taqsimot summasi noto‘g‘ri');
  if (sum.eq(0)) return weights.map(() => zero());
  const cents = total.times(100).toDecimalPlaces(0).toNumber();
  const raw = weights.map((w) => w.div(sum).times(cents));
  const units = raw.map((v) => v.floor().toNumber());
  let remainder = cents - units.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, index) => ({ index, fraction: v.minus(units[index]) }))
    .sort((a, b) => b.fraction.comparedTo(a.fraction) || a.index - b.index);
  for (const item of order) if (remainder-- > 0) units[item.index]++;
  return units.map((v) => money(new Prisma.Decimal(v).div(100)));
}
export function promotionDiscount(
  p: Promotion,
  subtotal: Prisma.Decimal,
  first: boolean,
  coupon?: string,
) {
  const now = new Date();
  if (
    !p.isActive ||
    (p.startAt && p.startAt > now) ||
    (p.endAt && p.endAt <= now) ||
    (p.minAmount && subtotal.lt(p.minAmount)) ||
    (p.firstPurchaseOnly && !first) ||
    (p.couponCode && p.couponCode !== coupon)
  )
    return zero();
  return money(
    Prisma.Decimal.min(
      subtotal,
      p.discountPercent ? subtotal.times(p.discountPercent).div(100) : (p.fixedAmount ?? zero()),
    ),
  );
}
export function bestPromotion(
  promotions: Promotion[],
  subtotal: Prisma.Decimal,
  first: boolean,
  coupon?: string,
) {
  return promotions
    .map((p) => ({ promotion: p, discount: promotionDiscount(p, subtotal, first, coupon) }))
    .sort(
      (a, b) => b.discount.comparedTo(a.discount) || a.promotion.id.localeCompare(b.promotion.id),
    )[0];
}
