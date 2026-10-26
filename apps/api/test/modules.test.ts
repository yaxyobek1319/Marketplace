import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Test } from '@nestjs/testing';
import { ModulesContainer } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { OrdersService } from '../src/commerce/orders.service';
import { NotificationsService } from '../src/operations/notifications.service';
import { SmsProvider, UnconfiguredSmsProvider } from '../src/integrations/providers';
test('all modules resolve and mutation routes declare explicit access', async () => {
  process.env.RUN_WORKERS = 'false';
  delete process.env.REDIS_URL;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    await app.init();
    assert.ok(app.get(OrdersService));
    assert.ok(app.get(NotificationsService));
    const modules = app.get(ModulesContainer);
    let endpoints = 0;
    for (const m of modules.values())
      for (const c of m.controllers.values()) {
        if (!c.instance) continue;
        const proto = Object.getPrototypeOf(c.instance);
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = proto[name];
          if (
            typeof handler !== 'function' ||
            Reflect.getMetadata(METHOD_METADATA, handler) === undefined
          )
            continue;
          endpoints++;
          const path = Reflect.getMetadata(PATH_METADATA, handler);
          const isPublic =
            Reflect.getMetadata('public', handler) || Reflect.getMetadata('public', c.metatype);
          const permissions =
            Reflect.getMetadata('permissions', handler) ||
            Reflect.getMetadata('permissions', c.metatype);
          assert.ok(
            isPublic || permissions?.length || path === 'logout-all',
            `Access policy missing: ${c.name}.${name}`,
          );
        }
      }
    assert.ok(endpoints > 70);
    await assert.rejects(app.get(SmsProvider).send('+998901234567', 'code', 'id'), /sozlanmagan/);
  } finally {
    await app.close();
  }
});
