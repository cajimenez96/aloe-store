# SP-01: Verificación técnica de Medusa 2.22

**Estado:** entregado, pendiente de aceptación del Product Owner
**Fecha:** 2026-10-23
**Versión verificada:** Medusa 2.22.0
**Documentos relacionados:** `arquitectura.md` (actualizado con estas respuestas), `seguridad.md`, `planning.md` (SP-01)

## Cómo se verificó

Tres fuentes, de más a menos confiable. Cada respuesta indica cuál la respalda.

1. **Prueba real** contra el backend de desarrollo (Docker Compose): compra completa de punta a punta con la API de tienda, API de admin y consulta a la base.
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
| 9 | Modo servidor y worker | Confirmado, con los nombres de variable del proyecto. |
| 10 | Sesión del panel | Cookie de sesión `HttpOnly`, 10 horas, `Secure` y `SameSite=Lax` en producción. |
| 11 | Precios con impuestos incluidos | Configurable por moneda o región. Por defecto no. |
| 12 | Límite de solicitudes nativo | **No hay.** Se resuelve en el proxy o con middleware propio. |

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

## 9. Modo servidor y worker

**Fuente:** documentación oficial, código y prueba real con Docker Compose.

- `projectConfig.workerMode` acepta `shared`, `server` y `worker`. El nombre de la variable de entorno lo elegimos nosotros: `MEDUSA_WORKER_MODE`.
- `DISABLE_MEDUSA_ADMIN` se conecta a `admin.disable`. Con `true`, el worker responde 404 en `/app`.
- Comprobado: servidor (con panel, migra la base) y worker (sin panel, no migra) corren desde la misma imagen.
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
