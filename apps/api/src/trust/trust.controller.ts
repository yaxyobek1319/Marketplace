import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import { amount, id, imageUrl, parse, text } from '../common/core';
import { PrismaService } from '../prisma.service';
import { TrustService } from './trust.service';
const evidence = z
  .object({ description: text, photos: z.array(imageUrl).max(10).default([]) })
  .strict();
const review = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(5000).optional(),
    photos: z.array(imageUrl).max(10).default([]),
  })
  .strict();
@Controller('trust')
export class TrustController {
  constructor(
    private readonly service: TrustService,
    private readonly db: PrismaService,
  ) {}
  @Post('items/:id/dispute') @Permissions('disputes:own') dispute(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          reason: z.enum([
            'ITEM_NOT_RECEIVED',
            'ITEM_SIGNIFICANTLY_DIFFERENT',
            'DAMAGED_IN_TRANSIT',
            'OTHER',
          ]),
          evidence,
        })
        .strict(),
      body,
    );
    return this.service.dispute(a.id, parse(id, value), d.reason, d.evidence);
  }
  @Post('disputes/:id/response') @Permissions('seller:own') response(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.disputeResponse(a.id, parse(id, value), parse(evidence, body));
  }
  @Post('disputes/:id/resolve') @Permissions('disputes:resolve') resolve(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          resolution: z.enum(['BUYER_FAVOR', 'SELLER_FAVOR', 'PARTIAL']),
          amount: amount.optional(),
        })
        .strict(),
      body,
    );
    return this.service.resolve(a.id, parse(id, value), d.resolution, d.amount);
  }
  @Post('items/:id/return') @Permissions('returns:own') requestReturn(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          reason: z.enum(['DEFECTIVE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND']),
          evidence,
          unusedOriginalPackaging: z.boolean().default(false),
        })
        .strict(),
      body,
    );
    return this.service.requestReturn(
      a.id,
      parse(id, value),
      d.reason,
      d.evidence,
      d.unusedOriginalPackaging,
    );
  }
  @Post('returns/:id/response') @Permissions('seller:own') returnResponse(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.returnResponse(a.id, parse(id, value), parse(evidence, body));
  }
  @Post('returns/:id/decision') @Permissions('returns:resolve') decision(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.returnDecision(
      a.id,
      parse(id, value),
      parse(z.object({ approve: z.boolean() }).strict(), body).approve,
    );
  }
  @Post('returns/:id/received') @Permissions('seller:own') received(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.service.returnReceived(a.id, parse(id, value));
  }
  @Post('returns/:id/refund') @Permissions('returns:resolve') refund(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.returnRefund(
      a.id,
      parse(id, value),
      parse(z.object({ restock: z.boolean() }).strict(), body).restock,
    );
  }
  @Public() @Get('products/:id/reviews') reviews(@Param('id') value: string) {
    return this.db.review.findMany({
      where: {
        productId: parse(id, value),
        deletedAt: null,
        product: { status: 'ACTIVE', seller: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        photos: true,
        sellerReply: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Post('items/:id/review') @Permissions('reviews:own') review(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.review(a.id, parse(id, value), parse(review, body));
  }
  @Patch('reviews/:id') @Permissions('reviews:own') edit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.editReview(a.id, parse(id, value), parse(review, body));
  }
  @Delete('reviews/:id') @Permissions('reviews:own') remove(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.service.deleteReview(a.id, parse(id, value), 'BUYER_DELETED', false);
  }
  @Post('reviews/:id/hide') @Permissions('reviews:moderate') hide(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.deleteReview(
      a.id,
      parse(id, value),
      parse(z.object({ reason: text }).strict(), body).reason,
      true,
    );
  }
  @Post('reviews/:id/reply') @Permissions('seller:own') reply(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.reply(
      a.id,
      parse(id, value),
      parse(z.object({ reply: text }).strict(), body).reply,
    );
  }
}
