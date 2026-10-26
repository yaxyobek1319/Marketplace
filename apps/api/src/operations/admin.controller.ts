import { Body, Controller, Get, Param, Patch, Post, Put, Query, Header } from '@nestjs/common';
import { z } from 'zod';
import { NotificationEventType } from '@prisma/client';
import { Actor, CurrentActor, Permissions } from '../auth/access';
import {
  amount,
  audit,
  emit,
  ensure,
  id,
  localized,
  lock,
  page,
  parse,
  positiveAmount,
  rate,
  required,
} from '../common/core';
import { PrismaService } from '../prisma.service';
const promotionInput = z
  .object({
    minAmount: amount.optional(),
    discountPercent: rate.optional(),
    fixedAmount: positiveAmount.optional(),
    couponCode: z.string().trim().min(3).max(100).optional(),
    firstPurchaseOnly: z.boolean().default(false),
    isActive: z.boolean().default(true),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.discountPercent) !== Boolean(v.fixedAmount),
    'Faqat bitta chegirma turi tanlansin',
  )
  .refine(
    (v) => !v.startAt || !v.endAt || new Date(v.startAt) < new Date(v.endAt),
    'Muddat noto‘g‘ri',
  );
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly db: PrismaService) {}
  @Get('mine') @Permissions('seller:own') mine(@CurrentActor() a: Actor) {
    return this.db.promotion.findMany({ where: { sellerId: a.sellerId, scope: 'SELLER' } });
  }
  @Post('seller') @Permissions('seller:own') seller(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const d = parse(promotionInput, body);
    return this.db.$transaction(async (tx) => {
      required(await tx.seller.findFirst({ where: { id: a.sellerId, status: 'ACTIVE' } }));
      return tx.promotion.create({ data: { ...d, scope: 'SELLER', sellerId: a.sellerId } });
    });
  }
  @Post('platform') @Permissions('promotions:platform:create') platform(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const d = parse(promotionInput, body);
    return this.db.$transaction(async (tx) => {
      const p = await tx.promotion.create({ data: { ...d, scope: 'PLATFORM' } });
      await audit(tx, a.id, 'PROMOTION_CREATED', 'Promotion', p.id, d);
      return p;
    });
  }
  @Patch('seller/:id') @Permissions('seller:own') sellerEdit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.db.promotion.update({
      where: { id: parse(id, value), scope: 'SELLER', sellerId: a.sellerId },
      data: parse(promotionInput, body),
    });
  }
  @Patch('platform/:id') @Permissions('promotions:platform:create') platformEdit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const d = parse(promotionInput, body);
    return this.db.$transaction(async (tx) => {
      const p = await tx.promotion.update({
        where: { id: parse(id, value), scope: 'PLATFORM' },
        data: d,
      });
      await audit(tx, a.id, 'PROMOTION_CREATED', 'Promotion', p.id, d);
      return p;
    });
  }
}
@Controller('admin')
export class AdminController {
  constructor(private readonly db: PrismaService) {}
  @Get('queues/sellers') @Permissions('sellers:review') sellers(@Query() query: unknown) {
    return this.db.seller.findMany({
      where: { status: 'PENDING' },
      ...parse(page, query),
      orderBy: { createdAt: 'asc' },
    });
  }
  @Get('queues/products') @Permissions('products:review') products(@Query() query: unknown) {
    return this.db.product.findMany({
      where: {
        OR: [
          { status: { in: ['PENDING_REVIEW', 'SUSPENDED'] } },
          { status: 'ACTIVE', moderationRequired: true },
        ],
      },
      ...parse(page, query),
      include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 }, images: true, variants: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  @Get('queues/disputes') @Permissions('disputes:resolve') disputes(@Query() query: unknown) {
    return this.db.dispute.findMany({
      where: { status: { not: 'RESOLVED' } },
      ...parse(page, query),
      orderBy: { createdAt: 'asc' },
      include: { orderItem: true },
    });
  }
  @Get('queues/returns') @Permissions('returns:resolve') returns(@Query() query: unknown) {
    return this.db.returnRequest.findMany({
      where: { status: { in: ['REQUESTED', 'APPROVED', 'ITEM_RECEIVED'] } },
      ...parse(page, query),
      orderBy: { createdAt: 'asc' },
      include: { orderItem: true },
    });
  }
  @Get('queues/payouts') @Permissions('payouts:manage') payouts(@Query() query: unknown) {
    return this.db.payout.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      ...parse(page, query),
      orderBy: { requestedAt: 'asc' },
      select: {
        id: true,
        payeeType: true,
        payeeId: true,
        amount: true,
        status: true,
        destinationMasked: true,
        requestedAt: true,
        provider: true,
        providerRef: true,
      },
    });
  }
  @Get('audit') @Permissions('audit:read') logs(@Query() query: unknown) {
    return this.db.adminActionLog.findMany({
      ...parse(page, query),
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('ledger') @Permissions('finance:read') ledger(@Query() query: unknown) {
    return this.db.ledgerEntry.findMany({ ...parse(page, query), orderBy: { createdAt: 'desc' } });
  }
  @Get('deposit-tiers') @Permissions('deposits:manage') tiers() {
    return this.db.depositTier.findMany({ orderBy: { minProductCount: 'asc' } });
  }
  @Put('deposit-tiers/:count') @Permissions('deposits:manage') tier(
    @CurrentActor() a: Actor,
    @Param('count') count: string,
    @Body() body: unknown,
  ) {
    const minProductCount = parse(z.coerce.number().int().min(0), count);
    const dto = parse(z.object({ depositAmount: positiveAmount }).strict(), body);
    return this.db.$transaction(async (tx) => {
      const t = await tx.depositTier.upsert({
        where: { minProductCount },
        create: { minProductCount, ...dto },
        update: dto,
      });
      await audit(tx, a.id, 'DEPOSIT_CHANGED', 'DepositTier', String(t.id), dto);
      return t;
    });
  }
  @Get('keywords') @Permissions('keywords:manage') keywords() {
    return this.db.prohibitedKeyword.findMany({ take: 1000, orderBy: { term: 'asc' } });
  }
  @Post('keywords') @Permissions('keywords:manage') keyword(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z
        .object({
          term: z.string().trim().min(2).max(100),
          severity: z.enum(['CRITICAL', 'MEDIUM']),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const k = await tx.prohibitedKeyword.create({ data: { ...dto, addedBy: a.id } });
      await audit(tx, a.id, 'KEYWORD_CHANGED', 'ProhibitedKeyword', k.id, dto);
      await emit(tx, 'catalog.rescan', {});
      return k;
    });
  }
  @Get('notification-templates') @Permissions('notifications:templates') templates() {
    return this.db.notificationTemplate.findMany();
  }
  @Put('notification-templates/:event') @Permissions('notifications:templates') template(
    @CurrentActor() a: Actor,
    @Param('event') event: string,
    @Body() body: unknown,
  ) {
    const eventType = parse(z.nativeEnum(NotificationEventType), event);
    const dto = parse(z.object({ bodyI18n: localized }).strict(), body);
    return this.db.$transaction(async (tx) => {
      const critical = [
        'SELLER_CONFIRMATION_NEEDED',
        'DISPUTE_OPENED',
        'DISPUTE_RESOLVED',
        'PAYOUT_COMPLETED',
      ].includes(eventType);
      const n = await tx.notificationTemplate.upsert({
        where: { eventType },
        create: { ...dto, eventType, critical },
        update: dto,
      });
      await audit(tx, a.id, 'TEMPLATE_CHANGED', 'NotificationTemplate', n.id, dto);
      return n;
    });
  }
  @Patch('staff/:id') @Permissions('staff:manage') staff(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const staffId = parse(id, value),
      dto = parse(z.object({ isActive: z.boolean() }).strict(), body);
    ensure(staffId !== a.id, 'O‘z akkauntingizni shu usulda bloklamang');
    return this.db.$transaction(async (tx) => {
      await lock(tx, `staff:${staffId}`);
      await tx.staffAccount.update({ where: { id: staffId }, data: dto });
      if (!dto.isActive)
        await tx.refreshToken.updateMany({
          where: { subjectType: 'STAFF', subjectId: staffId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await audit(tx, a.id, 'STAFF_CHANGED', 'StaffAccount', staffId, dto);
      return { id: staffId, ...dto };
    });
  }
  @Get('reports/finance') @Permissions('finance:read') report(@Query() query: unknown) {
    const q = parse(reportQuery, query);
    return this.db.ledgerEntry.groupBy({
      by: ['account', 'direction'],
      where: { createdAt: { gte: new Date(q.from), lte: new Date(q.to) } },
      _sum: { amount: true },
      _count: true,
    });
  }
  @Get('reports/tax') @Permissions('finance:read') tax(@Query() query: unknown) {
    const q = parse(reportQuery, query);
    return this.db
      .$queryRaw`SELECT i."sellerId", SUM(CASE WHEN l.direction = 'CREDIT' THEN l.amount ELSE -l.amount END)::text AS "taxAmount" FROM "LedgerEntry" l JOIN "OrderItem" i ON i.id = l."orderItemId" WHERE l.account = 'PLATFORM_TAX_PAYABLE' AND l."createdAt" >= ${new Date(q.from)} AND l."createdAt" <= ${new Date(q.to)} GROUP BY i."sellerId"`;
  }
  @Get('reports/popular') @Permissions('finance:read') popular() {
    return this.db.product.findMany({
      take: 50,
      orderBy: { viewCount: 'desc' },
      select: {
        id: true,
        titleI18n: true,
        viewCount: true,
        variants: { select: { salesCount: true } },
      },
    });
  }
  @Get('reports/finance.csv')
  @Permissions('finance:read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="finance.csv"')
  async csv(@Query() query: unknown) {
    const rows = await this.report(query);
    return (
      '\uFEFFaccount,direction,amount,count\r\n' +
      rows
        .map((r) =>
          [r.account, r.direction, r._sum.amount?.toFixed(2) ?? '0.00', r._count].join(','),
        )
        .join('\r\n')
    );
  }
}
const reportQuery = z
  .object({ from: z.string().datetime(), to: z.string().datetime() })
  .strict()
  .refine((v) => new Date(v.from) <= new Date(v.to), 'Davr noto‘g‘ri');
