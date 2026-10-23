# Se construye desde la raiz del monorepo: docker build -f apps/backend/Dockerfile .
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json
RUN pnpm install --frozen-lockfile --filter @aloe/backend...
COPY apps/backend apps/backend
WORKDIR /app/apps/backend

# Desarrollo: migra la base y arranca con recarga en caliente.
# En modo worker no migra: espera a que lo haga el servidor.
FROM base AS dev
EXPOSE 9100
CMD ["sh", "-c", "if [ \"$MEDUSA_WORKER_MODE\" != \"worker\" ]; then pnpm exec medusa db:migrate; fi && pnpm exec medusa develop"]

# Produccion: imagen compilada. El modo (server o worker) se define con MEDUSA_WORKER_MODE.
FROM base AS build
RUN pnpm exec medusa build

FROM node:22-slim AS prod
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/backend/.medusa/server /app
RUN pnpm install --prod && chown -R node:node /app
USER node
EXPOSE 9100
CMD ["sh", "-c", "if [ \"$MEDUSA_WORKER_MODE\" != \"worker\" ]; then pnpm exec medusa db:migrate; fi && pnpm exec medusa start"]
