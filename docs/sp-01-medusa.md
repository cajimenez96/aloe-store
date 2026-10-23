# SP-01: Verificación técnica de Medusa 2.22

**Estado:** entregado, pendiente de aceptación del Product Owner
**Fecha:** 2026-10-23
**Versión verificada:** Medusa 2.22.0
**Documentos relacionados:** `arquitectura.md` 3.1 y `seguridad.md` 2.1 (actualizados con estas respuestas), `planning.md` (SP-01)

## Cómo se verificó

Tres fuentes, de más a menos confiable. Cada respuesta indica cuál la respalda.

1. **Prueba real** contra el backend de desarrollo: compra completa de punta a punta con la API de tienda y la de admin, consulta a la base, subida de archivos y servidores en la máquina con PostgreSQL y Redis en Docker.
2. **Código instalado** en `node_modules/@medusajs/*` y los `AGENTS.md` que cada paquete trae para su versión.
3. **Documentación oficial** (`docs.medusajs.com`, agregando `.md` a la URL).

La prueba usó los datos de demostración de la starter (región Europa, EUR). Los comportamientos que dependen de la moneda no se repitieron con ARS; se indica donde importa.

## Resumen

| # | Punto | Resultado |
|---|---|---|
| 1 | Roles nativos (RBAC) | **No disponible**: es un módulo con licencia. Se usa el guard propio. |
| 2 | `metadata` en valores de opción | El campo existe, pero **no se pudo escribir** por la API de opciones. Falta probar otra ruta. |
| 3 | `metadata` de `Store` y de pedidos en la API de tienda | **No se exponen.** Pero `GET /store/orders/:id` expone datos personales sin autenticación. |
| 4 | Montos | **Unidades de la moneda**, no centavos. |
| 5 | Estado del pago con el proveedor manual | Pedido `pending`, pago `authorized` al completar el carrito. |
| 6 | Sesión de pago al cambiar promociones | **Se debe crear una sesión nueva** después de aplicar o quitar la promoción. |
| 7 | Liberación de reservas al cancelar | **Sí.** |
| 8 | Pedidos borrador para el punto de venta | **Sirven**, con pasos extra de pago y de stock. |
| 9 | Modo compartido y separación servidor y worker | Compartido es el valor por defecto. La separación funciona con `MEDUSA_WORKER_MODE`. |
| 10 | Sesión del panel | Cookie de sesión `HttpOnly`, 10 horas, `Secure` y `SameSite=Lax` en producción. |
| 11 | Precios con impuestos incluidos | Configurable por moneda o región. Por defecto no. |
| 12 | Límite de solicitudes nativo | **No hay.** Se implementa con middleware propio (SEC-17). |
| 13 | Validación de archivos al subir | **No hay.** Medusa aceptó texto como `.png`, HTML, `.exe` y 6 MB. Middleware propio. |
| 14 | Escuchar solo en localhost | `medusa develop --host 127.0.0.1` y `next dev -H 127.0.0.1`. Comprobado. |
| 15 | Primer usuario | `npx -w @aloe/backend medusa user -e <email> -p <clave>`. |
| 16 | `next/image` con imágenes de `localhost` | Next.js 16.4.3 las rechaza por defecto. Se resuelve con `dangerouslyAllowLocalIP` en desarrollo. |
| 17 | URL de las imágenes locales | El proveedor local **no lee** `MEDUSA_BACKEND_URL`: usa su opción `backend_url`. |

## 1. Roles nativos (RBAC)

**Fuente:** `AGENTS.md` de `@medusajs/rbac`.

El módulo existe (roles, políticas, herencia), pero **está desactivado por defecto** (`MEDUSA_FF_RBAC=false`) y es un **módulo licenciado**: el cargador solo lo habilita si la licencia cubre RBAC.

**Decisión:** no es una opción para el MVP0. Se implementa el guard propio con denegación por defecto (`seguridad.md`, SEC-21).

## 2. `metadata` en valores de opción

**Fuente:** código del módulo de productos y prueba real.

- El modelo `ProductOptionValue` tiene el campo `metadata` (JSON), y la API lo devuelve.
- Se intentó escribirlo con `POST /admin/product-options/:id` enviando los valores con `metadata`. Respondió 400: la ruta espera la lista de valores como textos, no como objetos.
- **No se probaron** otras rutas, por ejemplo `POST /admin/products/:id`.

**Decisión provisoria:** HU-09 usa el módulo propio con vínculo a `ProductOptionValue` (alternativa ya prevista en `arquitectura.md`, sección 7.2). Si al implementar HU-09 aparece una ruta que escriba `metadata`, se simplifica.

## 3. Exposición de `metadata` y datos de pedidos

**Fuente:** prueba real sin autenticación de cliente, solo con la clave publicable.

- `metadata` de `Store`: no existe ninguna ruta `/store/stores`. No se expone.
- `metadata` del pedido: `GET /store/orders/:id` no la devuelve ni pidiendo `fields=metadata`. El hash del token de acceso en `metadata` no se filtra por esa ruta.
- **Hallazgo grave:** `GET /store/orders/:id` **no requiere autenticación**. Con solo el ID y la clave publicable devuelve el email, los totales y, pidiendo `fields=*shipping_address`, el nombre y la dirección del cliente. (`GET /store/orders`, la lista, sí exige cliente autenticado y responde 401.)

**Decisión:** la tienda nunca usa `/store/orders/:id`. Una regla en `middlewares.ts` debe responder 404 a `/store/orders/*` y la tienda consulta el pedido por `/store/order-access/:id` con token (`arquitectura.md`, sección 13.3). Hay que cubrirlo con una prueba automatizada. Se suma a HU-23.

## 4. Convención de montos

**Fuente:** prueba real.

Un carrito con un producto de 10 EUR y un envío de 10 EUR dio `total: 20`. Un precio cargado como `1500` en ARS se guarda como `1500` en la tabla `price`. **Los montos están en la unidad de la moneda, no en centavos.**

## 5. Estado del pago con el proveedor manual

**Fuente:** código del proveedor `pp_system_default` y prueba real.

El proveedor manual autoriza el pago de inmediato. Al completar el carrito, el pedido queda con `status: pending` y `payment_status: authorized`. Es el estado que `arquitectura.md`, sección 8, supone para "Pendiente de pago". La captura (pago cobrado) la hace el admin al aceptar el comprobante.

## 6. Sesión de pago al cambiar promociones

**Fuente:** workflow `refreshPaymentCollectionForCartWorkflow` y prueba real.

Cuando cambia el total del carrito, Medusa sincroniza el monto de la colección de pago y **borra sus sesiones**. En la prueba: sesión con monto 20, se aplicó el código (total 19), y al crear la sesión de nuevo el monto fue 19 con una sola sesión.

**Consecuencia para HU-21:** el orden es elegir medio, aplicar o quitar la promoción, crear la sesión y completar. Nunca se reutiliza un ID de sesión anterior.

**Promociones por código:** `POST /store/carts/:id/promotions` aplica y `DELETE /store/carts/:id/promotions` con `promo_codes` en el cuerpo quita. Una promoción de porcentaje sobre el pedido dio un descuento de 1 sobre un subtotal de 10, es decir, 10 % sobre los productos y no sobre el envío.

**Nota:** una promoción automática con una regla sobre el medio de pago no es una opción. Los atributos de regla que ofrece Medusa no incluyen el medio de pago.

## 7. Liberación de reservas al cancelar

**Fuente:** prueba real.

Un pedido completado creó 1 reserva. Al cancelarlo con `POST /admin/orders/:id/cancel`, la reserva desapareció y el pedido quedó `canceled` con el pago `canceled`. La cancelación nativa libera el stock.

## 8. Pedidos borrador para el punto de venta

**Fuente:** prueba real y `AGENTS.md` de `@medusajs/draft-order`.

Flujo comprobado:

1. `POST /admin/draft-orders` con variantes, cantidades, canal de venta y región.
2. `POST /admin/draft-orders/:id/convert-to-order` crea el pedido (`pending`, `not_paid`) y **crea la reserva de stock**.
3. `POST /admin/payment-collections` con el pedido y el monto.
4. `POST /admin/payment-collections/:id/mark-as-paid` deja el pago `captured`.

Sirven como base. `POST /admin/pos/sales` encadena estos pasos en un workflow propio.

**Pendiente para HU-34:** tras el pago, el stock físico (`stocked_quantity`) **no baja**: solo queda reservado. Baja al registrar el despacho (fulfillment). Para el local, la venta debe crear y completar el despacho en el mismo paso. Se verifica al implementar.

## 9. Modo compartido y separación servidor y worker

**Fuente:** documentación oficial, código y prueba real.

- **Compartido (MVP0 local):** es el valor por defecto de `projectConfig.workerMode`. Un solo proceso atiende solicitudes y ejecuta jobs y suscriptores. No requiere configuración. Es lo que corre `npm run dev`.
- **Separación (despliegue, TEC-03):** `workerMode` acepta `server` y `worker`. El nombre de la variable de entorno lo elegimos nosotros: `MEDUSA_WORKER_MODE`. `admin.disable` con `DISABLE_MEDUSA_ADMIN=true` apaga el panel en el worker.
- Se probó la separación con dos contenedores de la misma imagen: el servidor migró la base y el worker no, y el worker respondió 404 en `/app`. Esa prueba ya no es parte del repositorio, porque los Dockerfiles son de la etapa de despliegue; queda en el historial de Git.
- Con procesos separados, el bus de eventos y el motor de workflows de Redis son obligatorios. Es inferencia: la página citada no menciona Redis.
- Medusa 2.11 en adelante admite `medusa start --cluster N --servers X --workers Y`.

## 10. Sesión del panel

**Fuente:** código de `@medusajs/framework` y prueba real.

- Login: `POST /auth/user/emailpass` devuelve un JWT. `POST /auth/session` con ese JWT crea una **sesión por cookie** (`connect.sid`, `HttpOnly`).
- Vencimiento por defecto: **10 horas** (`sessionOptions.ttl`).
- En `production` y `staging` la cookie es `Secure` y `SameSite=Lax`. En desarrollo no. Por eso el entorno de staging debe usar `NODE_ENV=staging` o `production`.
- Con `REDIS_URL`, las sesiones se guardan en Redis.
- Medusa no trae bloqueo por intentos fallidos ni doble factor. Coincide con `seguridad.md`, SEC-20.

## 11. Precios con impuestos incluidos

**Fuente:** prueba real.

Existe `GET /admin/price-preferences`, con una preferencia por moneda y por región. Todas vienen con `is_tax_inclusive: false`. Para HU-04 hay que crear la preferencia de `ars` y de la región Argentina con `true`. **No se probó la escritura**, solo la lectura.

## 12. Límite de solicitudes

**Fuente:** búsqueda en el código de rutas y comandos de `@medusajs/medusa`.

No hay limitador de solicitudes. Se aplica en el proxy de Coolify o con un middleware propio, como prevé `seguridad.md`, SEC-17. Se suma a HU-43.

## Hallazgos adicionales

- **Categorías:** el campo nativo es `is_active` y su valor **por defecto es `false`**. Una categoría nueva no se ve en la tienda hasta activarla. La guía del dueño de HU-07 debe decirlo.
- **Datos de demostración:** la migración inicial de la starter crea una región Europa en EUR, canal "Default Sales Channel", clave publicable y 4 productos. Corre también en producción. HU-04 debe reemplazarla por la configuración de Argentina.
- **Vulnerabilidad crítica de dependencias:** `proxy-addr` (por `@medusajs/test-utils`) bloqueaba la auditoría. Se resolvió con un `override` en `package.json`.
- **Mercado Pago:** Medusa solo trae el proveedor de Stripe. SP-02 sigue pendiente.
- **Redis:** existen los módulos de caché y de bloqueo (`locking-redis`). El bloqueo es relevante para HU-47 (sobreventa) y no se configuró todavía.
- **Rutas nativas usadas por la tienda** (todas existen): `/store/products`, `/store/product-categories`, `/store/regions`, `/store/carts` y `/store/carts/:id`, `/line-items` (y `/:line_id`), `/promotions`, `/shipping-methods`, `/complete`, `/store/shipping-options`, `/store/payment-providers`, `/store/payment-collections` y `/payment-sessions`.

## 13. Validación de archivos al subir

**Fuente:** prueba real con `POST /admin/uploads` y el proveedor local.

Medusa **no valida el tipo, el contenido ni el tamaño**. Con un usuario administrador, todas estas subidas respondieron 200 y quedaron en `static/`:

| Archivo | Resultado |
|---|---|
| PNG válido | aceptado |
| Texto con extensión `.png` | aceptado |
| HTML con un `<script>` | aceptado |
| `.exe` | aceptado |
| PNG de 6 MB | aceptado |

SEC-50 pide JPG, PNG o WebP de hasta 5 MB, validando el contenido real. Hace falta un middleware propio sobre `/admin/uploads` que verifique el tamaño y los primeros bytes del archivo (HU-05). Los archivos de prueba se borraron.

## 14. Escuchar solo en localhost

**Fuente:** prueba real.

- Medusa: `medusa develop --host 127.0.0.1` (también `start`). Se comprobó con `lsof` que el proceso escucha en `127.0.0.1:9100` y que la IP de la red local rechaza la conexión.
- Next.js: `next dev -H 127.0.0.1` y `next start -H 127.0.0.1`, con el mismo resultado en el puerto 3000.
- Ambos scripts ya quedaron así en los `package.json`.
- PostgreSQL y Redis: `127.0.0.1:<puerto>:<puerto>` en `docker-compose.yml`. `docker ps` los muestra solo en `127.0.0.1`.

## 15. Primer usuario administrador

**Fuente:** prueba real.

`npx -w @aloe/backend medusa user -e <email> -p <contraseña>` crea el usuario después de migrar la base. No hay usuario por defecto.

## 16. `next/image` con imágenes de localhost

**Fuente:** prueba real contra el optimizador de Next.js 16.4.3.

- Con `images.remotePatterns` apuntando a `localhost`, el optimizador responde 400: *"upstream image hostname resolved to private IP"*.
- Con `images.dangerouslyAllowLocalIP: true` responde 200 y entrega la imagen optimizada.
- Esa opción es una protección contra SSRF que se desactiva a propósito. Se activa solo cuando `NEXT_PUBLIC_IMAGES_HOST` es `localhost` o `127.0.0.1`, con `remotePatterns` acotado al host y a la ruta `/static/**`. No depende de `NODE_ENV`: el build de producción (`next start`) que se prueba en local también tiene las imágenes en `localhost` (HU-46). Con un dominio público no se activa y se exige https.

## 17. URL de las imágenes con el proveedor local

**Fuente:** prueba real.

Con `MEDUSA_BACKEND_URL=http://localhost:9100`, la subida devolvió `http://localhost:9000/static/...`. El proveedor `file-local` toma la base de su opción `backend_url`, que por defecto es `http://localhost:9000`. Para cumplir HU-05 ("la URL base sale de `MEDUSA_BACKEND_URL`") hay que registrar el módulo de archivos en `medusa-config.ts` con `backend_url: process.env.MEDUSA_BACKEND_URL`.

## 18. Middlewares globales de `/admin`

**Fuente:** prueba real durante HU-38.

- Un middleware definido en `defineMiddlewares` con `matcher` de **expresión regular** y sin `method` **no se ejecuta**: Medusa 2.22 lo acepta sin avisar y la solicitud pasa de largo. Con un matcher de texto con comodín (`'/admin*'`) sí se ejecuta. La primera versión del guard de roles usaba una expresión regular y dejó pasar a un vendedor a `/admin/users` y a crear una clave de API; la matriz de rutas por rol lo detectó antes de cualquier uso real.
- El middleware se ejecuta antes que los handlers de las rutas y se le puede anteponer `authenticate("user", ["session", "bearer", "api-key"], { allowUnauthenticated: true })` para tener `auth_context` sin depender del orden interno.
- Medusa trae un mecanismo de políticas por ruta (`policies`), pero depende del módulo RBAC con licencia (punto 1) y no se usa.
- **Mayúsculas:** Express enruta sin distinguirlas. `POST /admin/Regions` llega a la misma ruta que `/admin/regions`, así que una política que compara rutas con mayúsculas se evade. La política las normaliza a minúsculas. Lo detectó la verificación independiente de HU-38 antes de cualquier uso real: con `/admin/Users/<id propio>` un admin podía ascenderse a superadmin.
- **Metadata de la tienda:** `GET /admin/stores` devuelve la `metadata` completa (CBU, alias y código de la promoción de transferencia). Para el vendedor se quita de la respuesta.
- **Arranque del panel:** el panel de Medusa pide `/admin/stores`, `/admin/layouts/*`, `/admin/regions`, `/admin/sales-channels`, `/admin/feature-flags` y `/admin/notifications` al cargar. Si alguna se deniega con 403, el panel entero muestra "An error occurred". Se probó en un navegador real con un vendedor.
- **Claves secretas:** una clave de API secreta actúa como `api-key` y el guard no la restringe: equivale a superadmin. Solo la crea el superadmin (SEC-22).
- **Invitaciones:** `POST /admin/invites` acepta `metadata`, pero Medusa no la copia al usuario al aceptar, y `invites/accept` rechaza `metadata`. Hoy no es explotable; no depender de ello.

