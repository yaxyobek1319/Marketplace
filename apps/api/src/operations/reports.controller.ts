import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions } from '../auth/access';
import { audit, emit, ensure, id, lock, page, parse, required, text } from '../common/core';
import { PrismaService } from '../prisma.service';
const period = z
  .object({ from: z.string().datetime(), to: z.string().datetime() })
  .strict()
  .refine((v) => new Date(v.from) <= new Date(v.to));
@Controller()
export class ReportsController {
  constructor(private readonly db: PrismaService) {}
  @Post('reports') @Permissions('profile:own') report(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const d = parse(
      z.object({ targetType: z.enum(['PRODUCT', 'REVIEW']), targetId: id, reason: text }).strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      if (d.targetType === 'PRODUCT')
        required(
          await tx.product.findFirst({
            where: { id: d.targetId, status: 'ACTIVE', seller: { status: 'ACTIVE' } },
          }),
        );
      else
        required(
          await tx.review.findFirst({
            where: { id: d.targetId, deletedAt: null, product: { status: 'ACTIVE' } },
          }),
        );
      const r = await tx.contentReport.upsert({
        where: {
          reporterId_targetType_targetId: {
            reporterId: a.id,
            targetType: d.targetType,
            targetId: d.targetId,
          },
        },
        create: { ...d, reporterId: a.id },
        update: {},
      });
      if (d.targetType === 'PRODUCT') await emit(tx, 'catalog.report', { productId: d.targetId });
      return r;
    });
  }
  @Get('admin/queues/reports') @Permissions('admin:queues') async list(@Query() query: unknown) {
    const reports = await this.db.contentReport.findMany({
      where: { resolvedAt: null },
      ...parse(page, query),
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      reports.map(async (report) => ({
        ...report,
        target:
          report.targetType === 'PRODUCT'
            ? await this.db.product.findUnique({
                where: { id: report.targetId },
                include: { images: true },
              })
            : await this.db.review.findUnique({ where: { id: report.targetId } }),
      })),
    );
  }
  @Post('admin/reports/:id/resolve') @Permissions('admin:queues') resolve(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const reportId = parse(id, value),
      d = parse(z.object({ resolution: text }).strict(), body);
    return this.db.$transaction(async (tx) => {
      await lock(tx, `report:${reportId}`);
      const r = required(await tx.contentReport.findUnique({ where: { id: reportId } }));
      ensure(!r.resolvedAt, 'Shikoyat ko‘rib chiqilgan');
      const result = await tx.contentReport.update({
        where: { id: reportId },
        data: { resolvedAt: new Date(), resolvedBy: a.id, ...d },
      });
      await audit(tx, a.id, 'REPORT_RESOLVED', 'ContentReport', reportId, d);
      return result;
    });
  }
  @Patch('admin/keywords/:id') @Permissions('keywords:manage') keyword(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const keyId = parse(id, value),
      d = parse(
        z
          .object({
            term: z.string().trim().min(2).max(100),
            severity: z.enum(['CRITICAL', 'MEDIUM']),
          })
          .strict(),
        body,
      );
    return this.db.$transaction(async (tx) => {
      const old = required(await tx.prohibitedKeyword.findUnique({ where: { id: keyId } }));
      const result = await tx.prohibitedKeyword.update({ where: { id: keyId }, data: d });
      await audit(tx, a.id, 'KEYWORD_CHANGED', 'ProhibitedKeyword', keyId, {
        from: { term: old.term, severity: old.severity },
        to: d,
      });
      await emit(tx, 'catalog.rescan', {});
      return result;
    });
  }
  @Delete('admin/keywords/:id') @Permissions('keywords:manage') remove(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    const keyId = parse(id, value);
    return this.db.$transaction(async (tx) => {
      const old = await tx.prohibitedKeyword.delete({ where: { id: keyId } });
      await audit(tx, a.id, 'KEYWORD_CHANGED', 'ProhibitedKeyword', keyId, { removed: old.term });
      return { deleted: true };
    });
  }
  @Get('admin/reports/payouts') @Permissions('finance:read') payouts(@Query() query: unknown) {
    const q = parse(period, query);
    return this.db.payout.groupBy({
      by: ['payeeType', 'status'],
      where: { requestedAt: { gte: new Date(q.from), lte: new Date(q.to) } },
      _sum: { amount: true, bankFeeAmount: true },
      _count: true,
    });
  }
  @Get('admin/reports/sellers') @Permissions('finance:read') sellers(@Query() query: unknown) {
    const q = parse(period, query);
    return this.db
      .$queryRaw`SELECT s.id,s."storeName",s.rating::text, (SELECT COUNT(*)::integer FROM "SellerRatingEvent" r WHERE r."sellerId"=s.id AND r."createdAt" BETWEEN ${new Date(q.from)} AND ${new Date(q.to)}) AS "ratingEvents", (SELECT COUNT(*)::integer FROM "Dispute" d JOIN "OrderItem" i ON i.id=d."orderItemId" WHERE i."sellerId"=s.id AND d."createdAt" BETWEEN ${new Date(q.from)} AND ${new Date(q.to)}) AS disputes FROM "Seller" s ORDER BY s.id LIMIT 100`;
  }
  @Get('finance/seller-report') @Permissions('seller:own') async sellerReport(
    @CurrentActor() a: Actor,
    @Query() query: unknown,
  ) {
    const q = parse(period, query);
    return this.db
      .$queryRaw`SELECT l.account,l.direction,SUM(l.amount)::text AS amount FROM "LedgerEntry" l LEFT JOIN "OrderItem" i ON i.id=l."orderItemId" WHERE l."createdAt" BETWEEN ${new Date(q.from)} AND ${new Date(q.to)} AND (l."ownerId"=${a.sellerId!} OR (i."sellerId"=${a.sellerId!} AND l.account IN ('PLATFORM_TAX_PAYABLE','PLATFORM_COMMISSION_REVENUE'))) GROUP BY l.account,l.direction`;
  }
  @Get('finance/seller-report.csv')
  @Permissions('seller:own')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="seller-report.csv"')
  async csv(@CurrentActor() a: Actor, @Query() query: unknown) {
    const rows = (await this.sellerReport(a, query)) as {
      account: string;
      direction: string;
      amount: string;
    }[];
    return (
      '\uFEFFaccount,direction,amount\r\n' +
      rows.map((r) => [r.account, r.direction, r.amount].join(',')).join('\r\n')
    );
  }
}
