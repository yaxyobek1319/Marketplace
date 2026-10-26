import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { Actor, CurrentActor, Permissions, Public } from '../auth/access';
import { ProviderRegistry } from '../integrations/providers';
import { id, page, parse, positiveAmount, amount, required } from '../common/core';
import { PrismaService } from '../prisma.service';
import { orderStatus } from './order-status';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
@Controller('cart')
@Permissions('cart:own')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() get(@CurrentActor() a: Actor, @Query() query: unknown) {
    const dto = parse(z.object({ coupon: z.string().max(100).optional() }).strict(), query);
    return this.cart.preview(a.id, dto.coupon);
  }
  @Put('items/:id') set(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z
        .object({
          quantity: z.number().int().min(1).max(10000),
          deliveryType: z.enum(['EXPRESS', 'STANDARD', 'FREE']),
        })
        .strict(),
      body,
    );
    return this.cart.set(a.id, parse(id, value), dto.quantity, dto.deliveryType);
  }
  @Delete('items/:id') remove(@CurrentActor() a: Actor, @Param('id') value: string) {
    return this.cart.remove(a.id, parse(id, value));
  }
  @Put('sellers/:id/delivery') delivery(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.cart.groupDelivery(
      a.id,
      parse(id, value),
      parse(z.object({ deliveryType: z.enum(['EXPRESS', 'STANDARD', 'FREE']) }).strict(), body)
        .deliveryType,
    );
  }
}
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly db: PrismaService,
  ) {}
  @Post('checkout') @Permissions('orders:own') checkout(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    return this.orders.checkout(
      a.id,
      parse(
        z
          .object({
            addressId: id,
            idempotencyKey: id,
            provider: z.string().min(1).max(50),
            expectedTotal: amount,
            quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
            coupon: z.string().max(100).optional(),
          })
          .strict(),
        body,
      ),
    );
  }
  @Get() @Permissions('orders:own') async list(@CurrentActor() a: Actor, @Query() query: unknown) {
    const orders = await this.db.order.findMany({
      where: { buyerId: a.id },
      ...parse(page, query),
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { shipment: true } } },
    });
    return orders.map((order) => ({
      ...order,
      status: orderStatus(order.items.map((i) => i.status)),
    }));
  }
  @Get('seller-items') @Permissions('seller:own') seller(
    @CurrentActor() a: Actor,
    @Query() query: unknown,
  ) {
    return this.db.orderItem.findMany({
      where: { sellerId: a.sellerId!, order: { paymentStatus: 'PAID' } },
      ...parse(page, query),
      orderBy: { id: 'desc' },
      include: { shipment: true, dispute: true, returnRequest: true },
    });
  }
  @Get(':id') @Permissions('orders:own') async detail(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    const order = required(
      await this.db.order.findFirst({
        where: { id: parse(id, value), buyerId: a.id },
        include: {
          items: { include: { shipment: true, dispute: true, returnRequest: true } },
          payments: true,
        },
      }),
    );
    return { ...order, status: orderStatus(order.items.map((i) => i.status)) };
  }
  @Post('items/:id/confirm') @Permissions('seller:own') confirm(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
    @Body() body: unknown,
  ) {
    return this.orders.confirm(
      a.id,
      parse(id, value),
      parse(z.object({ accept: z.boolean() }).strict(), body).accept,
    );
  }
  @Post('items/:id/complete') @Permissions('orders:own') complete(
    @CurrentActor() a: Actor,
    @Param('id') value: string,
  ) {
    return this.orders.complete(a.id, parse(id, value));
  }
}
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly db: PrismaService,
    private readonly providers: ProviderRegistry,
  ) {}
  @Get('providers') @Permissions('orders:own') providersList() {
    return [...this.providers.payments.keys()];
  }
  @Get('deposits') @Permissions('seller:own') deposits(@CurrentActor() a: Actor) {
    return this.db.payment.findMany({
      where: { sellerId: a.sellerId!, purpose: 'DEPOSIT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amount: true,
        provider: true,
        status: true,
        checkoutUrl: true,
        createdAt: true,
      },
    });
  }
  @Post('deposit') @Permissions('seller:own') deposit(
    @CurrentActor() a: Actor,
    @Body() body: unknown,
  ) {
    const dto = parse(
      z.object({ amount: positiveAmount, provider: z.string().min(1).max(50) }).strict(),
      body,
    );
    return this.payments.deposit(a.id, dto.amount, dto.provider);
  }
  @Public() @Post('webhooks/:provider') webhook(
    @Param('provider') provider: string,
    @Req() req: { headers: Record<string, string>; rawBody?: Buffer },
  ) {
    if (!req.rawBody) throw new BadRequestException();
    return this.payments.webhook(provider, req.headers, req.rawBody);
  }
}
