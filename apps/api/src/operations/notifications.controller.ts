import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import { id, page, parse } from '../common/core';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly db: PrismaService,
    private readonly service: NotificationsService,
  ) {}
  @Get() @Permissions('notifications:own') list(@CurrentActor() a: Actor, @Query() query: unknown) {
    return this.db.notification.findMany({
      where: { userId: a.id },
      ...parse(page, query),
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post('push-tokens') @Permissions('notifications:own') token(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({ token: z.string().min(20).max(4096), platform: z.enum(['ios', 'android']) })
        .strict(),
      body,
    );
    return this.db.pushToken.upsert({
      where: { token: d.token },
      create: { ...d, userId: a.id },
      update: { ...d, userId: a.id, isActive: true },
    });
  }
  @Delete('push-tokens/:id') @Permissions('notifications:own') remove(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.db.pushToken.updateMany({
      where: { id: parse(id, value), userId: a.id },
      data: { isActive: false },
    });
  }
  @Post('telegram/link') @Permissions('notifications:own') link(@CurrentActor() a: Actor) {
    return this.service.link(a.id);
  }
  @Delete('telegram/link') @Permissions('notifications:own') unlink(@CurrentActor() a: Actor) {
    return this.db.user.update({
      where: { id: a.id },
      data: { telegramChatId: null },
      select: { id: true },
    });
  }
  @Public() @Post('telegram/webhook') bind(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() body: unknown,
  ) {
    const d = parse(
      z
        .object({
          message: z
            .object({
              chat: z.object({ id: z.number().int(), type: z.string().optional() }).passthrough(),
              text: z.string().optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
      body,
    );
    return this.service.bind(secret, d);
  }
}
