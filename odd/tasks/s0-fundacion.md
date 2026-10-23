# Sprint 0 - Fundacion local (Aloe)

Objective: entorno local reproducible, verificaciones automaticas, verificacion tecnica de Medusa y decision sobre Mercado Pago. Alcance: solo desarrollo local (docs v3).
Branch: main | Remote: origin (https://github.com/cajimenez96/aloe-store.git) agregado, SIN push hasta que el usuario certifique la conformidad con los docs | Runner: jest (backend, `npm run test:unit --workspace @aloe/backend`), `npm run check`
Source of truth: `docs/planning.md` v3 (S0 = HU-01, HU-05, TEC-01, SP-01, SP-02; 19 puntos), `docs/arquitectura.md` 3.1, `docs/seguridad.md` 2.1, `docs/producto.md` 3.

## Specs

S1 (HU-01) Como desarrollador, quiero levantar todo el sistema en mi computadora con pocos comandos, para trabajar sin depender de ningun servicio externo.
- S1.1 `docker compose up -d` levanta PostgreSQL y Redis con healthchecks, publicados solo en `127.0.0.1` (SEC-04).
- S1.2 Backend (`:9000`) y storefront (`:3000`) se levantan con un comando, con recarga automatica, y escuchan solo en localhost (SEC-06). [Verificar] la opcion en cada uno.
- S1.3 Existen `.env.example` del backend y del storefront con todas las variables de `arquitectura.md`, seccion 17.5, sin valores reales, y `.gitignore` excluye `.env*`, `static/` y `storage/`.
- S1.4 El README explica los requisitos (Node.js 22.22 o superior y Docker), como levantar, detener y reiniciar desde cero (`docker compose down -v`) y como crear el primer usuario administrador.
- S1.5 Una persona que no participo en la configuracion logra levantar el sistema siguiendo solo el README.

S2 (HU-05) Imagenes de producto en local.
- S2.1 Las imagenes subidas desde el panel se guardan con el proveedor local de Medusa y se ven en el storefront.
- S2.2 Un archivo de mas de 5 MB, de un formato distinto de JPG, PNG o WebP, o cuyo contenido real no coincide con su extension, se rechaza con un mensaje claro (SEC-50).
- S2.3 Ningun archivo privado se guarda en `static/`, que es una carpeta publica.
- S2.4 La URL base de las imagenes sale de `MEDUSA_BACKEND_URL`.

S3 (TEC-01) Verificaciones automaticas locales.
- S3.1 `npm run check` ejecuta lint, tipos, pruebas, build y auditoria de dependencias del backend y del storefront (SEC-80).
- S3.2 La auditoria falla ante vulnerabilidades criticas.
- S3.3 Un hook de pre-push ejecuta las verificaciones rapidas y bloquea el push si fallan.
- S3.4 Un hook de pre-commit bloquea archivos `.env` y patrones de claves (SEC-10).

S4 (SP-01) Verificacion tecnica de Medusa 2.22: documento con la respuesta a cada punto [Verificar] (incluye modo compartido, validacion de archivos, escuchar solo en localhost, primer usuario e imagenes de `localhost` con `next/image`) y `arquitectura.md` actualizado con las respuestas.

S5 (SP-02) Mercado Pago: integracion, pedido y pruebas en local. Prerrequisito del usuario: aplicacion de prueba y cuentas de prueba de vendedor y comprador en Mercado Pago Developers. NO iniciado.

Decisiones del usuario: commits convencionales con detalle en espanol, sin ID de historia ni atribucion; el despliegue (Coolify, R2, email real, dominio, CI) queda fuera del MVP0; storefront desde cero.

## Tasks

- T1 | S1 | inline | [x*] | npm workspaces, compose solo PostgreSQL+Redis en 127.0.0.1, backend y storefront en la maquina con `--host 127.0.0.1`, README, .gitignore | Evidencia: `docker ps` muestra 127.0.0.1:<puerto>; backend y storefront escuchan en 127.0.0.1 y rechazan la IP de la LAN (curl 000); migraciones + primer usuario OK. *PENDIENTE: `.env.example` de backend y storefront segun v3 17.5: los permisos del entorno deniegan escribir esas rutas (el de backend sigue con variables de la v2). Contenido en README. S1.5 (persona externa) no verificado.
- T2 | S3 | inline | [x] | `scripts/check.sh`, `.githooks/pre-commit`, `.githooks/pre-push`, `npm run check` / `check:fast` | Evidencia: `npm run check` exit 0 (lint, tipos, pruebas, auditoria critica, build). Pre-commit probado con indice: bloquea `.env` y token `APP_USR-`. Pre-push no ejecutado en un push real.
- T3 | S4 | inline | [x] | `docs/sp-01-medusa.md` (17 puntos) + `arquitectura.md` 3.1 + `seguridad.md` 2.1. Pendiente aceptacion del PO.
- T4 | S2 | inline | [x] | HU-05: `src/lib/uploads/validate-image.ts` (12 pruebas unitarias, RED observado antes) + middleware en POST /admin/uploads + `backend_url` del modulo de archivos desde `MEDUSA_BACKEND_URL` + `next/image` para el host de imagenes (dev). Evidencia en vivo: PNG valido 200 con URL `http://localhost:9200/static/...` (PORT/MEDUSA_BACKEND_URL de la prueba) y servido 200; texto como .png, HTML, .exe: 415; 6 MB: 413; optimizador de Next: host/ruta permitidos 200, otro host y otra ruta 400. PENDIENTE: prueba de integracion HTTP del middleware (medusaIntegrationTestRunner); `static/` sigue publica y nada privado se guarda ahi (comprobantes van a storage/private, HU-28).
- T5 | S5 | - | [ ] | SP-02 | bloqueada: falta la app de prueba de Mercado Pago

## Log

L1 (2026-10-23, usuario): "Si, me parece perfecto. Ahora que entendemos de que va el producto, podemos comenzar a desarrollar siguiendo @docs/planning.md"
L2 (2026-10-23, usuario): "Utilicemos conventional commits pero el detalle debe ser en español, por ejemplo: 'feat: se agrega filtro...'"
L3 (2026-10-23, usuario): "De momento no tengo coolify, la idea es aplicarlo luego"
L4 (2026-10-23, usuario): "Antes de hacer un push revisa nuevamente los documentos, hicimos una v3. Una vez que leamos todos los documentos y certifiquemos que vamos acorde a lo que estos documentos dicen podemos hacer push"
L5 (2026-10-23, usuario): "si, apliquemos las correcciones" (autoriza borrar CI, Dockerfiles y archivos de pnpm de mis propios commits).
L6: Causa raiz historica del fallo de migraciones en Docker: Medusa fuerza SSL si el host no es localhost/127.0.0.1 ni trae sslmode=disable. Con la v3 (host 127.0.0.1) ya no aplica.
L7: Puertos del usuario ocupados por otros contenedores: 9000 (mandix-minio), 9001 (consola de minio), 6379 (az-chatbot-redis), 5433. Mi entorno usa los puertos del documento por defecto y variables de shell para desviar: REDIS_PORT=6380 (compose), PORT=9100 (backend). No se crearon archivos .env.
L8: El seed inicial de la starter (`src/migration-scripts/initial-data-seed.ts`) crea datos demo (region Europa, EUR, 4 productos). HU-04 (S1) lo reemplaza por la configuracion de Argentina con `scripts/setup-store.ts`.
L9: Docs v3 sobrescribieron las respuestas de SP-01 en arquitectura.md; se reaplicaron en 3.1 y se agregaron a seguridad.md 2.1.
L10: planning.md seccion 14 vuelve a decir commits `HU-XX: descripcion`, que contradice L2. Se mantiene L2; pendiente que el usuario actualice el documento.
L11: Auditoria: con npm hay 83 vulnerabilidades (74 altas, 9 moderadas), ninguna critica; la instalacion con pnpm tenia 30. Informativas.
L12: Se eliminaron del MVP0 (siguen en el historial de Git): `.github/` (CI y Dependabot, TEC-06 es de despliegue), Dockerfiles de backend y storefront (TEC-03), servicios medusa-server, medusa-worker y storefront del compose.
