import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService } from '../commerce/orders.service';
import { PaymentsService } from '../commerce/payments.service';
import { PayoutsService } from '../commerce/payouts.service';
import { TrustService } from '../trust/trust.service';
import { DeliveryService } from './delivery.service';
import { NotificationsService } from './notifications.service';
import { StatsService } from './stats.service';
import { SearchService } from './search.service';
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;
  private pumping = false;
  constructor(
    private readonly db: PrismaService,
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly trust: TrustService,
    private readonly delivery: DeliveryService,
    private readonly notifications: NotificationsService,
    private readonly search: SearchService,
    private readonly stats: StatsService,
  ) {}
  async onModuleInit() {
    if (process.env.RUN_WORKERS !== 'true') return;
    const url = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username || undefined,
      password: url.password || undefined,
      db: Number(url.pathname.slice(1) || 0),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    };
    this.queue = new Queue('marketplace', {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 86400 },
        removeOnFail: { age: 30 * 86400 },
      },
    });
    this.worker = new Worker('marketplace', (job) => this.handle(job), {
      connection,
      concurrency: 4,
    });
    this.worker.on('error', () => this.logger.error('Worker infrastructure error'));
    this.worker.on('failed', (job) => {
      this.logger.error(`Job failed: ${job?.name} (${job?.id})`);
      if (job?.name === 'notification.send' && job.attemptsMade >= (job.opts.attempts ?? 1))
        void this.notifications
          .exhausted(job.data.notificationId)
          .catch(() => this.logger.error('Notification fallback scheduling failed'));

      if (job?.name === 'delivery.dispatch' && job.attemptsMade >= (job.opts.attempts ?? 1))
        void this.delivery
          .failed(job.data.shipmentId)
          .catch(() => this.logger.error('Failed shipment status update failed'));
    });
    for (const name of [
      'stats.flush',
      'orders.deadlines',
      'trust.deadlines',
      'payments.poll',
      'payouts.poll',
      'delivery.batch',
    ])
      await this.queue.add(name, {}, { jobId: name, repeat: { every: 60000 } });
    for (const name of ['search.rebuild', 'catalog.rescan', 'auth.cleanup', 'sellers.resume'])
      await this.queue.add(name, {}, { jobId: name, repeat: { every: 86400000 } });
    await this.queue.add('search.rebuild', {}, { jobId: 'initialize-search' });
    this.timer = setInterval(() => void this.pump(), 1000);
    await this.pump();
  }
  async pump() {
    if (this.pumping || !this.queue) return;
    this.pumping = true;
    try {
      const rows = await this.db.outboxEvent.findMany({
        where: { publishedAt: null },
        take: 100,
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
      for (const row of rows) {
        await this.queue.add(row.topic, row.payload as object, {
          jobId: row.id,
          priority: row.priority,
        });
        await this.db.outboxEvent.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
      }
    } catch {
      this.logger.error('Outbox publishing failed; will retry');
    } finally {
      this.pumping = false;
    }
  }
  async handle(job: Job) {
    const d = job.data;
    switch (job.name) {
      case 'stats.flush':
        return this.stats.flush();
      case 'search.product':
        return this.search.product(d.productId);
      case 'search.seller':
        return this.search.seller(d.sellerId);
      case 'search.rebuild':
        return this.search.rebuild();
      case 'catalog.report':
        return this.catalog.rescan(undefined, d.productId);
      case 'catalog.rescan':
        return this.catalog.rescan(d.categoryId);
      case 'orders.deadlines':
        return this.orders.deadlines();
      case 'trust.deadlines':
        return this.trust.deadlines();
      case 'payment.create':
        return this.payments.create(d.paymentId);
      case 'payments.poll':
        return this.payments.poll();
      case 'payout.send':
        return this.payouts.send(d.payoutId);
      case 'payouts.poll':
        return this.payouts.poll();
      case 'delivery.dispatch':
        return this.delivery.dispatch(d.shipmentId);
      case 'delivery.batch':
        return this.delivery.batch();
      case 'notification':
        return this.notifications.enqueue(d.eventKey, d.userId, d.eventType, d.payload);
      case 'notification.send':
        return this.notifications.send(d.notificationId);
      case 'auth.cleanup':
        return this.db.authAttempt.deleteMany({
          where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
        });
      case 'sellers.resume':
        return this.resumeSellers();
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }
  async resumeSellers() {
    const suspended = await this.db.seller.findMany({
      where: {
        status: 'SUSPENDED',
        rejectionReason: null,
        sanctions: { some: { type: 'TEMP_SUSPENSION' } },
      },
      select: { id: true },
    });
    for (const seller of suspended)
      await this.db.$transaction(async (tx) => {
        const { lock, emit } = await import('../common/core');
        await lock(tx, `seller:${seller.id}`);
        const current = await tx.seller.findUnique({ where: { id: seller.id } });
        if (current?.status !== 'SUSPENDED' || current.rejectionReason) return;
        const active = await tx.sellerSanction.count({
          where: {
            sellerId: seller.id,
            OR: [
              { type: 'PERMANENT_BAN' },
              { type: 'TEMP_SUSPENSION', OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
            ],
          },
        });
        if (!active) {
          await tx.seller.update({ where: { id: seller.id }, data: { status: 'ACTIVE' } });
          await emit(tx, 'search.seller', { sellerId: seller.id });
        }
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
