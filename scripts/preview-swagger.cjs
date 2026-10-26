// Documentation-only server: no AppModule, Prisma, Redis, or business endpoints.
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule } = require('@nestjs/swagger');
const { apiDocument } = require('../apps/api/dist/openapi/document');
class DocsModule {}
Module({})(DocsModule);
async function main() {
  const app = await NestFactory.create(DocsModule, { logger: false });
  const document = {
    ...apiDocument,
    servers: [
      {
        url: process.env.SWAGGER_API_URL || 'http://127.0.0.1:3001',
        description: 'Haqiqiy API; ishga tushgan va CORS sozlangan bo‘lishi kerak',
      },
    ],
  };
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Marketplace API — Swagger',
    jsonDocumentUrl: '/api/docs-json',
    yamlDocumentUrl: '/api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
      filter: true,
      docExpansion: 'none',
      validatorUrl: null,
    },
  });
  app.enableShutdownHooks();
  const port = Number(process.env.SWAGGER_PORT || 3002);
  await app.listen(port, '127.0.0.1');
  console.log(
    `Swagger: http://127.0.0.1:${port}/api/docs (documentation only; no database connection)`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
