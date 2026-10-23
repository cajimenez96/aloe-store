# Aloe (nombre de referencia)

Tienda online con punto de venta local, sobre Medusa 2.22. Una instancia por cliente.

Documentación: [producto](docs/producto.md), [arquitectura](docs/arquitectura.md), [seguridad](docs/seguridad.md), [planificación](docs/planning.md) y [guía visual](docs/DESIGN.md).

## Requisitos

- Node.js 22.23.4 (ver `.nvmrc`; Medusa 2.22 admite de 22.22 a 24). Con nvm: `nvm use`.
- pnpm 10 (`corepack enable` lo activa).
- Docker con el daemon corriendo.

## Estructura

```
apps/backend      Medusa 2.22 (API, panel y extensiones propias)
apps/storefront   Next.js 16.4.3 (tienda)
docs/             Producto, arquitectura, seguridad y planificación
odd/tasks/        Seguimiento del trabajo por sprint
```

## Entorno local con Docker

`docker compose up -d --build` levanta cinco servicios. PostgreSQL y Redis tienen healthcheck y el resto espera a que estén sanos. El servidor de Medusa migra la base y el worker espera a que el servidor esté listo. El código de `apps/backend/src` y `apps/storefront/src` se recarga en caliente.

| Servicio | Puerto en tu máquina | Qué hace |
|---|---|---|
| `medusa-server` | 9100 | API, panel (`/app`) y webhooks. `http://localhost:9100/health` |
| `medusa-worker` | — | Jobs y suscriptores. Sin panel ni puertos. |
| `storefront` | 8000 | Tienda. `http://localhost:8000` |
| `postgres` | 5434 | Usuario `aloe`, base `aloe_store`. Solo se publica en desarrollo. |
| `redis` | 6380 | Solo se publica en desarrollo. |

Los puertos no son los estándar (9000, 5432, 6379) para no chocar con otros servicios locales.

### Levantar

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f medusa-server
```

Al terminar de arrancar, `docker compose ps` muestra `postgres`, `redis`, `medusa-server` y `storefront` en `healthy` y el worker en `Up`.

### Crear el primer usuario

```bash
docker compose exec medusa-server pnpm exec medusa user -e admin@example.com -p <contraseña>
```

Luego se entra a `http://localhost:9100/app`. La clave publicable que usa el storefront se crea en el panel (Configuración, Claves de API) y se pasa a Docker con `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` en un archivo `.env` junto al `docker-compose.yml`.

### Detener y reiniciar

```bash
docker compose stop              # detiene sin borrar datos
docker compose start             # vuelve a levantar con los mismos datos
docker compose restart medusa-server medusa-worker
```

### Reiniciar desde cero (borra la base y Redis)

```bash
docker compose down -v --remove-orphans
docker compose up -d --build
```

## Variables de entorno

Cada app tiene su `.env.example` con las variables de [arquitectura.md](docs/arquitectura.md), sección 17.5. Docker Compose funciona sin ningún `.env`, con valores de desarrollo. Para correr fuera de Docker, copiar `apps/backend/.env.example` a `apps/backend/.env`. Nunca se suben credenciales reales. En el storefront solo pueden tener prefijo `NEXT_PUBLIC_` la URL del backend, la clave publicable y el dominio de imágenes (seguridad.md, SEC-10).

## Desarrollo sin Docker

Con PostgreSQL y Redis de Docker arriba (`docker compose up -d postgres redis`):

```bash
pnpm install
cd apps/backend && pnpm exec medusa db:migrate
pnpm backend:dev
pnpm storefront:dev
```

## Calidad

```bash
pnpm lint
pnpm --filter @aloe/backend run test:unit --passWithNoTests
pnpm build
pnpm audit --audit-level=critical
```

El CI (`.github/workflows/ci.yml`) corre lo mismo en cada pull request.

## Commits

Conventional commits con el detalle en español: `feat: se agrega filtro por subcategoría`.
