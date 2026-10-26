import { BadRequestException, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import { PrismaService } from '../prisma.service';
import { id, page, parse } from '../common/core';
import { DeliveryService } from './delivery.service';
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly service: DeliveryService,
    private readonly db: PrismaService,
  ) {}
  @Get('failed') @Permissions('admin:queues') failures(@Query() q: unknown) {
    return this.db.shipment.findMany({
      where: { status: 'FAILED' },
      ...parse(page, q),
      orderBy: { createdAt: 'asc' },
    });
  }
  @Post('shipments/:id/retry') @Permissions('admin:queues') retry(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.service.retry(a.id, parse(id, value));
  }
  @Post('items/:id/ready') @Permissions('seller:own') ready(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.service.ready(a.id, parse(id, value));
  }
  @Public() @Post('webhooks/:provider') webhook(
    @Param('provider') provider: string,
    @Req() req: { headers: Record<string, string>; rawBody?: Buffer },
  ) {
    if (!req.rawBody) throw new BadRequestException();
    return this.service.webhook(provider, req.headers, req.rawBody);
  }
}
