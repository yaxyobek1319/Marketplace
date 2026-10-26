import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { apiDocument } from './document';
export function setupSwagger(app: INestApplication) {
  if (process.env.SWAGGER_ENABLED === 'false') return;
  SwaggerModule.setup('api/docs', app, apiDocument, {
    customSiteTitle: 'Marketplace API — Swagger',
    jsonDocumentUrl: '/api/docs-json',
    yamlDocumentUrl: '/api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      validatorUrl: null,
    },
  });
}
