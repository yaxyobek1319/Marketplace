require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ModulesContainer } = require('@nestjs/core');
const { RequestMethod } = require('@nestjs/common');
const { METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants');
const { AppModule } = require('../apps/api/dist/app.module');
const { PrismaService } = require('../apps/api/dist/prisma.service');
const { writeFileSync } = require('node:fs');
async function main() {
  process.env.RUN_WORKERS = 'false';
  delete process.env.REDIS_URL;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  try {
    const routes = [];
    for (const m of module.get(ModulesContainer).values())
      for (const c of m.controllers.values()) {
        if (!c.instance) continue;
        const prefix = Reflect.getMetadata(PATH_METADATA, c.metatype),
          proto = Object.getPrototypeOf(c.instance);
        for (const name of Object.getOwnPropertyNames(proto)) {
          const fn = proto[name];
          if (typeof fn !== 'function') continue;
          const method = Reflect.getMetadata(METHOD_METADATA, fn);
          if (method === undefined) continue;
          const path = Reflect.getMetadata(PATH_METADATA, fn);
          routes.push({
            method: RequestMethod[method],
            path: `/api/v1/${prefix}/${path}`.replace(/\/+/g, '/').replace(/\/$/, ''),
            public: !!(
              Reflect.getMetadata('public', fn) || Reflect.getMetadata('public', c.metatype)
            ),
            permissions:
              Reflect.getMetadata('permissions', fn) ||
              Reflect.getMetadata('permissions', c.metatype) ||
              [],
          });
        }
      }
    routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    writeFileSync('docs/API_ROUTES.json', JSON.stringify(routes, null, 2) + '\n');
    if (process.argv.includes('--web'))
      writeFileSync(
        'apps/web/src/lib/api-routes.json',
        JSON.stringify(
          routes.filter((r) => !r.path.includes('webhook') && r.path !== '/api/v1/auth/refresh'),
          null,
          2,
        ) + '\n',
      );
    process.stdout.write(`${routes.length} routes exported.\n`);
  } finally {
    await module.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
