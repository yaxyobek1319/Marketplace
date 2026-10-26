import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';
@Injectable()
export class StatsService implements OnModuleDestroy {
  private redis?: Redis;
  constructor(private readonly db: PrismaService) {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (attempt) => Math.min(attempt * 1000, 30000),
      });
      this.redis.on('error', () => {});
    }
  }
  async client() {
    if (this.redis?.status === 'wait') await this.redis.connect();
    return this.redis;
  }
  async view(productId: string) {
    try {
      const redis = await this.client();
      await redis?.incr(`views:${productId}`);
    } catch {
      /* TZ: counters must never block product reads. */
    }
    return { accepted: true };
  }
  async flush() {
    const redis = await this.client();
    if (!redis) return;
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', 'views:*', 'COUNT', 100);
      cursor = result[0];
      for (const key of result[1]) {
        const count = Number(await redis.getset(key, '0'));
        if (!count) continue;
        try {
          await this.db.product.updateMany({
            where: { id: key.slice(6) },
            data: { viewCount: { increment: count } },
          });
        } catch (error) {
          await redis.incrby(key, count);
          throw error;
        }
      }
    } while (cursor !== '0');
  }
  async onModuleDestroy() {
    this.redis?.disconnect();
  }
}
