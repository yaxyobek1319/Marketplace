FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
COPY scripts/generate-openapi.cjs scripts/openapi-responses.cjs scripts/
RUN mkdir -p docs
RUN npm run db:generate && npm run build -w @marketplace/api && npm prune --omit=dev
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api ./apps/api
RUN mkdir -p /app/uploads/products && chown -R node:node /app/uploads
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
