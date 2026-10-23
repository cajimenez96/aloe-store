# Se construye desde la raiz del monorepo: docker build -f apps/storefront/Dockerfile .
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN pnpm install --frozen-lockfile --filter @aloe/storefront...
COPY apps/storefront apps/storefront
WORKDIR /app/apps/storefront

# Desarrollo: recarga en caliente sobre el codigo montado.
FROM base AS dev
EXPOSE 8000
CMD ["pnpm", "exec", "next", "dev", "-p", "8000", "-H", "0.0.0.0"]

# Produccion: modo standalone. Las variables NEXT_PUBLIC_ se fijan al construir.
FROM base AS build
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_IMAGES_DOMAIN
RUN pnpm exec next build

FROM node:22-slim AS prod
ENV NODE_ENV=production PORT=8000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build --chown=node:node /app/apps/storefront/public ./apps/storefront/public
USER node
EXPOSE 8000
CMD ["node", "apps/storefront/server.js"]
