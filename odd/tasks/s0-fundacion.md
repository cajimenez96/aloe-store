# Sprint 0 - Fundacion (Aloe)

Objective: entorno local reproducible, CI y verificacion tecnica de Medusa 2.22 (HU-02 Coolify diferida por el usuario).
Branch: main (sin remoto aun) | Delivery: ask-on-risk | Runner: jest (backend, `pnpm test:unit`), lint `pnpm lint`
Source of truth: `docs/planning.md` seccion 7 (HU-01, HU-03, TEC-01, SP-02) y `docs/arquitectura.md`.

## Specs

S1 (HU-01) Como equipo de desarrollo, quiero un monorepo con entorno Docker local, para levantar el sistema completo con un solo comando.
- S1.1 `docker compose up` levanta PostgreSQL, Redis y el backend en una maquina limpia.
- S1.2 Los healthchecks de PostgreSQL y Redis estan en verde antes de que arranque el backend.
- S1.3 Existe `.env.example` con todas las variables de `arquitectura.md`, seccion 5.2, y el repositorio no contiene credenciales reales.
- S1.4 El README explica como levantar, detener y reiniciar el entorno limpio.

S2 (HU-03) Como admin, quiero subir imagenes de producto que queden disponibles publicamente, para mostrarlas en la tienda.
- S2.1 Subir una imagen JPG, PNG o WebP devuelve una URL bajo el dominio `S3_FILE_URL`.
- S2.2 Un archivo mayor a 5 MB o de otro formato se rechaza con un mensaje que indica el limite y los formatos validos.
- S2.3 El bucket de productos no contiene comprobantes ni archivos privados.
- Nota: requiere credenciales de R2 (pendiente del usuario).

S3 (TEC-01) Como equipo de desarrollo, quiero que cada cambio pase automaticamente por lint, pruebas y build.
- S3.1 Cada pull request ejecuta lint, pruebas y build de backend y storefront.
- S3.2 Un pull request con fallos no puede integrarse.
- S3.3 Al integrar en la rama principal se construye la imagen Docker del backend.

S4 (SP-02) Confirmar los puntos pendientes de la arquitectura contra la version instalada (Medusa 2.22.0). Entregable: documento con respuestas y cambios propuestos a `arquitectura.md`.
- S4.1 Confirmar nombres de endpoints nativos usados en `arquitectura.md`, seccion 8.2.
- S4.2 Confirmar que las promociones automaticas por porcentaje sobre el pedido son posibles.
- S4.3 Confirmar si la sesion de pago se reinicia al cambiar el total del carrito.
- S4.4 Confirmar la convencion de montos (unidades o centavos).
- S4.5 Confirmar el modo de arranque de worker y backend.
- S4.6 Confirmar si los pedidos manuales sirven como base del punto de venta.

Decisiones del usuario: commits convencionales con detalle en espanol, sin HU-ID ni atribucion; Coolify mas adelante.

## Tasks

- T1 | S1 | inline | [x] | scaffold Medusa 2.22 + Docker compose + .env.example + README | commits: a924bb8, 4215309. Evidencia: `docker compose down -v && up -d --build` desde cero deja los 3 servicios healthy, GET /health 200 y /app 200; redis y postgres healthy antes de iniciar el backend; lint backend 0 errores, storefront 0 errores (28 warnings del starter), tsc storefront limpio.
- T2 | S4 | inline | [x] | spike SP-02 en `docs/sp-02-medusa.md` (6 puntos respondidos con prueba real, codigo instalado y docs; cambios a arquitectura.md propuestos, no aplicados; pendiente aceptacion del PO) | commit: ver git log (docs: se documenta la verificacion tecnica de Medusa)
- T3 | S3 | inline | [ ] | CI (GitHub Actions) | commit: -
- T4 | S2 | inline | [ ] | file-s3 contra R2 (bloqueada por credenciales) | commit: -

## Log

L1 (2026-10-23, usuario): "Si, me parece perfecto. Ahora que entendemos de que va el producto, podemos comenzar a desarrollar siguiendo @docs/planning.md"
L2 (2026-10-23, usuario): "Utilicemos conventional commits pero el detalle debe ser en espanol, por ejemplo: 'feat: se agrega filtro...'"
L3 (2026-10-23, usuario): "De momento no tengo coolify, la idea es aplicarlo luego"
L5: Causa raiz del fallo de migraciones en Docker: Medusa (`loadDatabaseConfig`) fuerza SSL si el host de DATABASE_URL no es localhost/127.0.0.1 ni trae sslmode=disable; el Postgres del contenedor no tiene SSL y knex falla en silencio (propagateCreateError=false). Solucion: `?sslmode=disable` en la URL de compose. Tambien: el volumen solo montaba src, por eso se monta medusa-config.ts.
L4: Scaffold generado con create-medusa-app (Medusa 2.22.0, storefront con Next 16.3.8; arquitectura fija 16.4.3, que existe en npm). Puertos del host ocupados por otros contenedores del usuario: 5433, 6379, 9000. Se usaran 5434 (postgres), 6380 (redis), 9100 (backend).
