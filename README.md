# Aloe (nombre de referencia)

Tienda online con punto de venta local, sobre Medusa 2.22. Una instancia por cliente.

Documentación: [producto](docs/producto.md), [arquitectura](docs/arquitectura.md), [planificación](docs/planning.md) y [guía visual](docs/DESIGN.md).

## Requisitos

- Node.js 22.23.4 (ver `.nvmrc`; Medusa 2.22 admite de 22.22 a 24). Con nvm: `nvm use`.
- pnpm 10 (`corepack enable` lo activa).
- Docker con el daemon corriendo.

## Estructura

```
apps/backend      Medusa 2.22 (API, admin y extensiones propias)
apps/storefront   Next.js (tienda)
docs/             Producto, arquitectura y planificación
odd/tasks/        Seguimiento del trabajo por sprint
```

## Entorno local con Docker

`docker compose up` levanta PostgreSQL, Redis y el backend. El backend espera a que los dos healthchecks estén en verde, migra la base y arranca con recarga en caliente sobre `apps/backend/src`.

| Servicio | Puerto en tu máquina | Nota |
|---|---|---|
| Backend y API | 9100 | `http://localhost:9100/health` |
| Admin | 9100 | `http://localhost:9100/app` |
| PostgreSQL | 5434 | usuario `aloe`, base `aloe_store` |
| Redis | 6380 | |

Los puertos no son los estándar (9000, 5432, 6379) para no chocar con otros servicios locales.

### Levantar

```bash
docker compose up -d --build
docker compose logs -f backend
```

Al terminar de arrancar, `docker compose ps` muestra los tres servicios en `healthy`.

### Crear el primer usuario admin

```bash
docker compose exec backend pnpm exec medusa user -e admin@example.com -p <contraseña>
```

### Detener y reiniciar

```bash
docker compose stop            # detiene sin borrar datos
docker compose start           # vuelve a levantar con los mismos datos
docker compose restart backend # reinicia solo el backend
```

### Reiniciar desde cero (borra la base y Redis)

```bash
docker compose down -v
docker compose up -d --build
```

## Variables de entorno

`.env.example` lista todas las variables de [arquitectura.md](docs/arquitectura.md), sección 5.2. Docker Compose funciona sin ningún `.env`, con valores de desarrollo. Para correr fuera de Docker, copiar `.env.example` a `apps/backend/.env` y `apps/storefront/.env.local`. Nunca se suben credenciales reales.

## Desarrollo sin Docker para el backend

Con PostgreSQL y Redis de Docker arriba (`docker compose up -d postgres redis`):

```bash
pnpm install
cd apps/backend && pnpm exec medusa db:migrate
pnpm backend:dev
pnpm storefront:dev
```

## Commits

Conventional commits con el detalle en español: `feat: se agrega filtro por subcategoría`.
