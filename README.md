# Aloe (nombre de referencia)

Tienda online con punto de venta local, sobre Medusa 2.22. Una instancia por cliente.

El MVP0 se desarrolla y se prueba **solo en local**. Documentación: [producto](docs/producto.md), [arquitectura](docs/arquitectura.md), [seguridad](docs/seguridad.md), [planificación](docs/planning.md) y [guía visual](docs/DESIGN.md).

## Requisitos

- Node.js 22.22 o superior (el proyecto fija 22.23.4 en `.nvmrc`; con nvm: `nvm use`).
- npm 10 o superior (viene con Node).
- Docker con Compose.
- Git.

## Estructura

```
apps/backend      Medusa 2.22 (API, panel y extensiones propias)
apps/storefront   Next.js 16.4.3 (tienda)
scripts/          check.sh y, más adelante, setup-store y el simulador de Mercado Pago
.githooks/        pre-commit (bloquea .env y claves) y pre-push (verificaciones rápidas)
docs/             Producto, arquitectura, seguridad y planificación
odd/tasks/        Seguimiento del trabajo por sprint
```

## Puesta en marcha

```bash
npm install                    # instala todo y activa los hooks de Git
docker compose up -d --wait    # PostgreSQL y Redis, solo en 127.0.0.1
```

Crear `apps/backend/.env` y `apps/storefront/.env.local` con las variables de abajo, y luego:

```bash
npm run db:migrate             # crea las tablas
npm run setup:store            # configuración base de Argentina (idempotente)
npx -w @aloe/backend medusa user -e <email> -p <contraseña>   # primer usuario
npm run user:role -- <email> superadmin                        # le da el rol de superadmin
npm run email:preview                                   # vista previa de los emails en http://127.0.0.1:3900
npm run dev                    # backend en :9000 y storefront en :3000
```

`npm run setup:store` crea los canales "Web" y "Local", la región Argentina en ARS con precios con impuestos incluidos, la ubicación de stock "Local", las opciones de envío "Retiro en el local" y "Envío a domicilio", el proveedor de pago manual y una clave publicable asociada a "Web". Al terminar imprime esa clave para `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. Se puede ejecutar las veces que haga falta. No carga productos ni categorías.

El panel queda en `http://localhost:9000/app`. Backend y storefront escuchan solo en `127.0.0.1`.

### Roles

El rol de cada usuario se guarda en `metadata.role` y se asigna con `npm run user:role -- <email> <superadmin|admin|vendedor>`. **Un usuario sin rol es vendedor**, el perfil más restringido: puede consultar productos, stock y pedidos, y registrar ventas en el local, y nada más. Por eso el primer usuario necesita el paso `user:role` para poder administrar. El admin puede leer, pero no modificar, regiones, impuestos, proveedores de pago y claves de API: eso es del superadmin. Toda ruta nueva de `/admin` queda denegada al vendedor hasta que se habilite en `apps/backend/src/lib/roles/policy.ts`. Los accesos rechazados se registran en el log como `role_denied`.

Al vendedor se le oculta la `metadata` de la tienda (ahí están el CBU y el código de la promoción). El menú del panel de Medusa muestra todas las secciones aunque el vendedor no pueda usarlas: al entrar en una no permitida el panel avisa que no tiene permiso. Las claves de API secretas funcionan como superadmin: solo el superadmin las crea.

### Detener y reiniciar

```bash
docker compose stop            # detiene PostgreSQL y Redis conservando los datos
docker compose start
docker compose down -v         # DESTRUYE los datos y reinicia desde cero
```

Después de `down -v` hay que volver a migrar, a ejecutar `npm run setup:store` y a crear el usuario.

### Si un puerto está ocupado

Los puertos por defecto son 9000 (backend), 3000 (storefront), 5432 (PostgreSQL) y 6379 (Redis). Para PostgreSQL y Redis, crear un `.env` en la raíz con `POSTGRES_PORT` y `REDIS_PORT` (no se versiona) y ajustar `DATABASE_URL` y `REDIS_URL` del backend. Para el backend, cambiar `PORT` y las URLs que lo mencionan (`MEDUSA_BACKEND_URL`, `ADMIN_CORS`, `AUTH_CORS`, y `NEXT_PUBLIC_MEDUSA_BACKEND_URL` del storefront).

## Variables de entorno

Los secretos se generan en cada máquina (`openssl rand -hex 32`) y nunca se versionan. Lista completa en [arquitectura.md](docs/arquitectura.md), sección 17.5.

**`apps/backend/.env`**

```
NODE_ENV=development
LOG_LEVEL=info
PORT=9000
MEDUSA_BACKEND_URL=http://localhost:9000
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/medusa_dev
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=<generado>
COOKIE_SECRET=<generado>
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000
AUTH_CORS=http://localhost:9000,http://localhost:3000
PROOFS_STORAGE_DRIVER=local
PROOFS_LOCAL_DIR=../../storage/private/proofs
PROOFS_URL_SIGNING_SECRET=<generado>
MP_ACCESS_TOKEN=                 # solo credenciales de prueba
MP_WEBHOOK_SECRET=               # clave secreta de Webhooks de la app (o, con el simulador, un secreto de prueba)
MP_NOTIFICATION_URL=             # vacío si no hay URL pública
MP_BACK_URL_BASE=
```

**`apps/storefront/.env.local`**

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=
NEXT_PUBLIC_IMAGES_HOST=localhost:9000
```

Solo esas tres variables pueden llevar el prefijo `NEXT_PUBLIC_` (seguridad.md, SEC-10).

## Verificaciones

```bash
npm run check         # lint, tipos, pruebas, auditoría de dependencias y build
npm run check:fast    # lo mismo sin el build (lo ejecuta el hook de pre-push)
```

`npm install` activa los hooks de `.githooks/`: el de pre-commit bloquea archivos `.env` y patrones de claves, y el de pre-push corre `npm run check:fast`.

## Commits

Conventional commits con el detalle en español: `feat: se agrega filtro por subcategoría`.

### Variables del backend para pedidos

- `STOREFRONT_URL` (por defecto `http://localhost:3000`): base de los enlaces de los emails.
- `TRUSTED_PROXY_HOPS` (por defecto `0`): cuántos proxies de confianza hay delante del backend. Con `0` el límite de pedidos por IP usa la dirección de la conexión e ignora `X-Forwarded-For`, que el cliente puede inventar. Al desplegar detrás de un proxy hay que ponerlo en la cantidad real de saltos.
- `RATE_LIMITS` (JSON, opcional): cambia los límites de solicitudes sin tocar el código, por ejemplo `{"login":{"limit":3,"windowSeconds":30}}`. Claves: `login`, `checkout`, `store`. Una entrada inválida se ignora. El límite vive en memoria de una instancia.
- `TRUSTED_PROXY_HOPS` también va en el **storefront**, con el mismo valor que en el backend: el storefront llama al backend desde su servidor y reenvía la IP del cliente solo si se declara esto. Sin él, todos los clientes comparten una IP y los límites de solicitudes y de pedidos pendientes se aplican a todos juntos.
- `PROOFS_DIR` (opcional): carpeta privada de los comprobantes. Por defecto `apps/backend/storage/private/proofs`, fuera de `static/`.
- `LOG_LEVEL` (por defecto `http`): nivel de los logs. Con `NODE_ENV=production` salen en JSON, con fecha e identificador de solicitud. Los eventos de seguridad (logins, permisos, capturas, reembolsos, cancelaciones, límites) llevan el usuario y nunca datos personales.
- `LOG_EMAIL_BODIES` (solo desarrollo): con `true` el log de emails incluye el texto, para copiar el enlace de un pedido al probar en local. Por defecto solo registra plantilla, destinatario enmascarado y asunto.
- `MAX_PENDING_PER_EMAIL` (por defecto `2`) y `MAX_PENDING_PER_IP` (por defecto `3`): pedidos por transferencia pendientes por email y por IP en 24 horas (SEC-40). Un valor inválido deja el predeterminado.
- `INSECURE_SESSION_COOKIE` (solo pruebas locales): con `true` la cookie de sesión del panel no lleva `Secure`, para poder iniciar sesión en el build de producción por http (`npm run e2e`). El backend se niega a arrancar con esta variable si `MEDUSA_BACKEND_URL` no es `http://localhost:<puerto>`: nunca va en un despliegue.

### Pruebas de punta a punta

`npm run e2e` (necesita `docker compose up -d`) compila el backend y el storefront en modo producción, los levanta en los puertos 9300 y 3100 con una base de datos descartable, corre los escenarios de Playwright (`e2e/tests`), comprueba que el log del servidor no tenga datos personales y lo borra todo. Deja el reporte en `reports/e2e-produccion.json`. No toca la base de desarrollo ni el `.next` de `npm run dev`. Usa el Chromium que ya tengas en la caché de Playwright; si no hay, `npx playwright install chromium`. `E2E_KEEP=1 npm run e2e` deja el entorno levantado para depurar.

`node scripts/concurrency/last-unit.mjs` (contra un backend de pruebas) corre la prueba de la última unidad de stock; `scripts/k6/last-unit.js` es el mismo escenario para k6.

### Pago con tarjeta (Mercado Pago)

Sin `MP_ACCESS_TOKEN` la tienda acepta solo transferencia. Para probar la tarjeta sin cuenta ni internet se usa el simulador local:

```bash
npm run mp:simulator            # :9400, con una página de pago de prueba
# en apps/backend/.env (a mano):
#   MP_ACCESS_TOKEN=TEST-simulador   MP_API_BASE=http://localhost:9400
#   MP_WEBHOOK_SECRET=<un secreto largo de prueba>
npm run setup:store             # habilita el proveedor en la región
```

- `MP_ACCESS_TOKEN` (credencial de prueba o producción), `MP_API_BASE` (por defecto la API real; el simulador en pruebas) y `MP_WEBHOOK_SECRET` (secreto de firma del webhook).
- `MP_NOTIFICATION_URL` y `MP_BACK_URL_BASE`: opcionales. Sin URL pública la preferencia se crea sin ellas y el cliente vuelve a mano con «verificá tu pago»; el job de conciliación confirma los pagos que no avisaron.
- `MP_RECONCILE_AFTER_MINUTES` (por defecto `15`) y `MP_RECONCILE_EVERY_MINUTES` (por defecto `5`): cuándo y cada cuánto se concilian los pagos pendientes.
- `npm run mp:webhook -- --payment <id> --scenario valid|invalid-signature|expired|replay` envía una notificación firmada al backend local (necesita `MP_WEBHOOK_SECRET`).
