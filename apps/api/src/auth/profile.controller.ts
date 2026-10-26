import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';
import { Actor, CurrentActor, Permissions } from './access';
import { id, parse, phone, required, text } from '../common/core';
const address = z
  .object({
    label: z.string().max(100).optional(),
    address: text,
    recipientPhone: phone,
    region: z.string().min(1).max(100),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict();
@Controller('me')
@Permissions('profile:own')
export class ProfileController {
  constructor(private readonly db: PrismaService) {}
  @Get() get(@CurrentActor() a: Actor) {
    return this.db.user.findUnique({
      where: { id: a.id },
      select: {
        id: true,
        phone: true,
        fullName: true,
        locale: true,
        marketingEnabled: true,
        telegramChatId: true,
        seller: { select: { id: true, status: true, storeName: true } },
      },
    });
  }
  @Patch() update(@CurrentActor() a: Actor, @Body() body: unknown) {
    const dto = parse(
      z
        .object({
          fullName: z.string().trim().min(1).max(200).optional(),
          locale: z.enum(['uz', 'ru']).optional(),
          marketingEnabled: z.boolean().optional(),
        })
        .strict(),
      body,
    );
    return this.db.user.update({
      where: { id: a.id },
      data: dto,
      select: { id: true, fullName: true, locale: true, marketingEnabled: true },
    });
  }
  @Get('addresses') addresses(@CurrentActor() a: Actor) {
    return this.db.address.findMany({ where: { userId: a.id } });
  }
  @Post('addresses') add(@CurrentActor() a: Actor, @Body() body: unknown) {
    return this.db.address.create({ data: { ...parse(address, body), userId: a.id } });
  }
  @Patch('addresses/:id') edit(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.db.address.update({
      where: { id: parse(id, value), userId: a.id },
      data: parse(address.partial(), body),
    });
  }
  @Delete('addresses/:id') remove(@CurrentActor() a: Actor, @Param('id') value: string) {
    return this.db.address.delete({ where: { id: parse(id, value), userId: a.id } });
  }
  @Get('favorites') favorites(@CurrentActor() a: Actor) {
    return this.db.favorite.findMany({
      where: { userId: a.id, product: { status: 'ACTIVE', seller: { status: 'ACTIVE' } } },
      include: { product: { include: { images: true } } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post('favorites/:id') async favorite(@CurrentActor() a: Actor, @Param('id') value: string) {
    const productId = parse(id, value);
    required(
      await this.db.product.findFirst({
        where: { id: productId, status: 'ACTIVE', seller: { status: 'ACTIVE' } },
      }),
    );
    return this.db.favorite.upsert({
      where: { userId_productId: { userId: a.id, productId } },
      create: { userId: a.id, productId },
      update: {},
    });
  }
  @Delete('favorites/:id') unfavorite(@CurrentActor() a: Actor, @Param('id') value: string) {
    return this.db.favorite.deleteMany({ where: { userId: a.id, productId: parse(id, value) } });
  }
}
