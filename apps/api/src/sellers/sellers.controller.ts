import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import { id, parse, rate, required, text } from '../common/core';
import { PrismaService } from '../prisma.service';
import { SellersService } from './sellers.service';
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly service: SellersService,
    private readonly db: PrismaService,
  ) {}
  @Post() @Permissions('seller:apply') apply(@CurrentActor() a: Actor, @Body() body: unknown) {
    return this.service.apply(
      a.id,
      parse(
        z
          .object({
            storeName: z.string().trim().min(2).max(200),
            legalTaxId: z.string().regex(/^\d{9,14}$/),
            payoutAccount: z.string().regex(/^\*{4}\d{4}$/),
            pickupAddress: text,
          })
          .strict(),
        body,
      ),
    );
  }
  @Get('mine') @Permissions('seller:own') mine(@CurrentActor() a: Actor) {
    return this.db.seller.findUnique({ where: { userId: a.id } });
  }
  @Get(':id') @Public() async public(@Param('id') value: string) {
    return required(
      await this.db.seller.findFirst({
        where: { id: parse(id, value), status: 'ACTIVE' },
        select: { id: true, storeName: true, rating: true, createdAt: true },
      }),
    );
  }
  @Post(':id/review') @Permissions('sellers:review') review(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(z.object({ approve: z.boolean(), reason: text }).strict(), body);
    return this.service.review(a.id, parse(id, value), dto.approve, dto.reason);
  }
  @Put(':id/rates') @Permissions('sellers:rates') rates(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(z.object({ commissionRate: rate, taxRate: rate }).strict(), body);
    return this.service.rates(a.id, parse(id, value), dto.commissionRate, dto.taxRate);
  }
  @Post(':id/content-sanctions') @Permissions('sanctions:content') content(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.sanction(
      a.id,
      parse(id, value),
      parse(
        z
          .object({
            type: z.enum(['RATING_PENALTY', 'TEMP_SUSPENSION']),
            reason: text,
            endAt: z.string().datetime().optional(),
            points: z.number().positive().max(5).optional(),
          })
          .strict(),
        body,
      ),
    );
  }
  @Post(':id/finance-sanctions') @Permissions('sanctions:finance') finance(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.sanction(
      a.id,
      parse(id, value),
      parse(
        z
          .object({
            type: z.enum(['DEPOSIT_HOLD', 'PERMANENT_BAN']),
            reason: text,
            amount: z
              .string()
              .regex(/^\d+(\.\d{1,2})?$/)
              .optional(),
          })
          .strict(),
        body,
      ),
    );
  }
}
