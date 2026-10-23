# Sprint 0 - Fundacion (Aloe)

Objective: entorno local reproducible, CI y verificacion tecnica de Medusa 2.22 (HU-02 y HU-03 diferidas: aun no hay VPS ni Coolify).
Branch: main (sin remoto aun) | Delivery: ask-on-risk | Runner: jest (backend, `pnpm --filter @aloe/backend run test:unit`), lint `pnpm lint`
Source of truth: `docs/planning.md` v2 (HU-01, HU-02, HU-03, HU-05, TEC-01, SP-01), `docs/arquitectura.md` v2.1 y `docs/seguridad.md`.

## Specs

S1 (HU-01) Como desarrollador, quiero levantar todo el sistema en local con un comando, para trabajar en un entorno igual al de los servidores.
- S1.1 `docker compose up` levanta PostgreSQL, Redis, Medusa servidor, Medusa worker y storefront en una máquina limpia.
- S1.2 PostgreSQL y Redis tienen healthchecks y los demás servicios esperan a que estén listos.
- S1.3 Existen `.env.example` del backend y del storefront con todas las variables de `arquitectura.md`, sección 17.5, sin valores reales.
- S1.4 El README explica cómo levantar, detener, reiniciar desde cero y crear el primer usuario.

S2 (HU-02) Servidor y Coolify endurecidos (SEC-01, SEC-02, SEC-03). DIFERIDA: requiere VPS y autorizacion expresa del usuario para operar remoto.

S3 (HU-03) Staging en Coolify. DIFERIDA por la misma razon.

S4 (HU-05) Imágenes de producto en R2.
- S4.1 Las imágenes subidas desde el panel quedan en R2 y su URL usa el dominio `S3_FILE_URL`.
- S4.2 Archivos de más de 5 MB o de formato no permitido se rechazan con un mensaje claro (SEC-50).
- S4.3 El bucket no permite listar su contenido (SEC-52).
- Bloqueada: faltan credenciales y bucket de R2 y el dominio de imagenes.

S5 (TEC-01) Como equipo, quiero que cada cambio pase por lint, pruebas, build y auditoría de dependencias.
- S5.1 Cada pull request ejecuta lint, pruebas y build de backend y storefront.
- S5.2 La auditoría de dependencias bloquea el merge si hay vulnerabilidades críticas (SEC-80).
- S5.3 Las actualizaciones de dependencias se proponen de forma automática.
- S5.4 Un pull request con fallos no puede integrarse.

S6 (SP-01) Verificación técnica de Medusa 2.22.
- S6.1 Documento con la respuesta a cada punto [Verificar] de `arquitectura.md` y `seguridad.md`, con la fuente consultada.
- S6.2 Incluye como mínimo: roles nativos (RBAC) en la versión de código abierto, `metadata` en valores de opción, visibilidad de la `metadata` de `Store` y de pedidos en la API de tienda, convención de montos, estado del pago con el proveedor manual, recálculo de la sesión de pago al cambiar promociones, liberación de reservas al cancelar, pedidos borrador para el punto de venta, modo servidor y worker, mecanismo de sesión del panel, precios con impuestos incluidos y límite de solicitudes nativo.
- S6.3 `arquitectura.md` actualizado con las respuestas.

Decisiones del usuario: commits convencionales con detalle en español, sin ID de historia ni atribución; Coolify más adelante; storefront desde cero según arquitectura v2 (se eliminó la starter).

## Tasks

- T1 | S1 | inline | [x] | compose con servidor, worker y storefront (5 servicios), Dockerfiles dev/prod no root, .env.example por app, README | commits: 4215309, 607b928. Evidencia: `down -v --remove-orphans` + `up -d --build` desde cero: postgres, redis, medusa-server y storefront healthy, worker Up con admin desactivado (/app 404) y sin migrar; /health 200, /app 200, storefront 200. Imágenes prod de backend y storefront corren como usuario `node` y responden 200. FALTA: `apps/storefront/.env.example` (la ruta está denegada en los permisos del entorno; contenido propuesto en el reporte).
- T2 | S6 | inline | [x] | `docs/sp-01-medusa.md` + arquitectura.md 2.1 (12 puntos con prueba real, código instalado y docs). Pendiente aceptación del PO | commit: ver git log (docs: resultado de SP-01)
- T3 | S5 | inline | [~] | `.github/workflows/ci.yml` (backend, storefront, audit, imágenes prod en main) + `.github/dependabot.yml`. Cada paso corrido en local con exit 0 (lint, test:unit, build, audit crítico). PENDIENTE: correr en GitHub (no hay remoto) y activar protección de rama exigiendo los jobs backend, storefront y audit (S5.4) | commits: d1fcd22, ccae5c0
- T4 | S4 | inline | [ ] | file-s3 contra R2 | bloqueada por credenciales
- T5 | S2, S3 | - | [ ] | diferidas (Coolify)

## Log

L1 (2026-10-23, usuario): "Si, me parece perfecto. Ahora que entendemos de que va el producto, podemos comenzar a desarrollar siguiendo @docs/planning.md"
L2 (2026-10-23, usuario): "Utilicemos conventional commits pero el detalle debe ser en español, por ejemplo: 'feat: se agrega filtro...'"
L3 (2026-10-23, usuario): "De momento no tengo coolify, la idea es aplicarlo luego"
L4: Scaffold inicial con create-medusa-app (Medusa 2.22.0). Puertos del host ocupados por otros contenedores del usuario: 5433, 6379, 9000. Se usan 5434 (postgres), 6380 (redis), 9100 (backend).
L5: Causa raíz del fallo de migraciones en Docker: Medusa (`loadDatabaseConfig`) fuerza SSL si el host de DATABASE_URL no es localhost/127.0.0.1 ni trae sslmode=disable; el Postgres del contenedor no tiene SSL y knex falla en silencio. Solución: `?sslmode=disable` en la URL de compose.
L6: El seed inicial de la starter (`src/migration-scripts/initial-data-seed.ts`) crea datos demo (región Europa, EUR, canal "Default Sales Channel", clave publicable, 4 productos) y corre al migrar también en producción. HU-04 (S1) debe reemplazarlo por la configuración de Argentina.
L7 (2026-10-23, usuario): "hicimos una actualizacion en la documentacion, por favor revisala nuevamente y continuemos con esto". Docs pasan a v2: nueva numeración (SP-01 es la verificación técnica, SP-02 es Mercado Pago, HU-05 imágenes, HU-03 staging), nuevo `seguridad.md`, storefront desde cero, compose con servidor+worker+storefront, TEC-01 con auditoría y actualizaciones automáticas. Se reajustó S0 a esta versión.
L8: Auditoría de dependencias: había 1 vulnerabilidad crítica (`proxy-addr`, vía `@medusajs/test-utils`). Resuelta con `pnpm.overrides`. Quedan 16 altas y 11 moderadas, informativas.
L9: Inconsistencia de docs: `planning.md` sección 13 sigue pidiendo commits `HU-XX: descripción`, que contradice la decisión L2 del usuario. Se mantiene L2. Pendiente que el usuario actualice la sección 13.
