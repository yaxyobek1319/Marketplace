import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import {
  imageUrl,
  id,
  localized,
  page,
  parse,
  positiveAmount,
  required,
  text,
} from '../common/core';
import { PrismaService } from '../prisma.service';
import { StatsService } from '../operations/stats.service';
import { CatalogService, productInput, variantInput } from './catalog.service';
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly db: PrismaService,
    private readonly service: CatalogService,
    private readonly stats: StatsService,
  ) {}
  @Public() @Get('categories') categories() {
    return this.db.category.findMany({ where: { deletedAt: null }, orderBy: { id: 'asc' } });
  }
  @Public() @Get('products/:id') async product(@Param('id') value: string) {
    return required(
      await this.db.product.findFirst({
        where: {
          id: parse(id, value),
          status: 'ACTIVE',
          seller: { status: 'ACTIVE' },
          category: { deletedAt: null },
        },
        include: {
          variants: { where: { isActive: true }, include: { images: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          attributes: true,
          seller: { select: { id: true, storeName: true, rating: true } },
        },
      }),
    );
  }
  @Public() @Post('products/:id/view') async view(@Param('id') value: string) {
    const productId = parse(id, value);
    required(
      await this.db.product.findFirst({
        where: { id: productId, status: 'ACTIVE', seller: { status: 'ACTIVE' } },
        select: { id: true },
      }),
    );
    return this.stats.view(productId);
  }
  @Get('mine') @Permissions('seller:own') mine(@CurrentActor() a: Actor, @Query() query: unknown) {
    return this.db.product.findMany({
      where: { sellerId: a.sellerId! },
      ...parse(page, query),
      orderBy: { createdAt: 'desc' },
      include: { variants: true, images: true, attributes: true },
    });
  }
  @Post('products') @Permissions('seller:own') create(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    return this.service.create(a.id, parse(productInput, body));
  }
  @Patch('products/:id') @Permissions('seller:own') edit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.edit(
      a.id,
      parse(id, value),
      parse(
        z
          .object({
            titleI18n: localized.optional(),
            description: z.string().max(20000).optional(),
            mxikCodeOverride: z
              .string()
              .regex(/^\d{17}$/)
              .optional(),
          })
          .strict(),
        body,
      ),
    );
  }
  @Post('products/:id/submit') @Permissions('seller:own') submit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.service.submit(a.id, parse(id, value));
  }
  @Post('products/:id/moderate') @Permissions('products:review') moderate(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z.object({ status: z.enum(['ACTIVE', 'REJECTED', 'SUSPENDED']), reason: text }).strict(),
      body,
    );
    return this.service.moderate(a.id, parse(id, value), dto.status, dto.reason);
  }
  @Post('variants/:id/stock') @Permissions('seller:own') stock(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z
        .object({
          changeAmount: z
            .number()
            .int()
            .min(-1000000)
            .max(1000000)
            .refine((v) => v !== 0),
          reason: text,
        })
        .strict(),
      body,
    );
    return this.service.adjustStock(a.id, parse(id, value), dto.changeAmount, dto.reason);
  }
  @Patch('variants/:id') @Permissions('seller:own') variant(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.variantEdit(
      a.id,
      parse(id, value),
      parse(
        z.object({ price: positiveAmount.optional(), isActive: z.boolean().optional() }).strict(),
        body,
      ),
    );
  }
  @Post('products/:id/variants') @Permissions('seller:own') addVariant(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.addVariant(a.id, parse(id, value), parse(variantInput, body));
  }
  @Put('products/:id/images') @Permissions('seller:own') images(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z
        .object({
          images: z
            .array(
              z
                .object({
                  url: imageUrl,
                  variantId: id.optional(),
                  sortOrder: z.number().int().min(0),
                })
                .strict(),
            )
            .max(200),
        })
        .strict(),
      body,
    );
    return this.service.replaceMedia(a.id, parse(id, value), dto.images);
  }
  @Put('products/:id/attributes') @Permissions('seller:own') attributes(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(z.object({ attributes: productInput.shape.attributes }).strict(), body);
    return this.service.replaceAttributes(a.id, parse(id, value), dto.attributes);
  }
  @Post('categories') @Permissions('categories:manage') createCategory(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    return this.service.category(a.id, undefined, parse(categoryInput, body));
  }
  @Put('categories/:id') @Permissions('categories:manage') updateCategory(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.service.category(
      a.id,
      parse(z.coerce.number().int().positive(), value),
      parse(categoryInput, body),
    );
  }
}
const categoryInput = z
  .object({
    nameI18n: localized,
    parentId: z.number().int().positive().nullable().optional(),
    riskLevel: z.enum(['LOW', 'HIGH']),
    mxikCode: z
      .string()
      .regex(/^\d{17}$/)
      .optional(),
    hidden: z.boolean().optional(),
  })
  .strict();
