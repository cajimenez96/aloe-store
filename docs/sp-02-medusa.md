# SP-02: Verificación técnica de Medusa 2.22.0

**Estado:** entregado, pendiente de aceptación
**Fecha:** 2026-10-23
**Versión verificada:** Medusa 2.22.0 (instalada en `apps/backend`)
**Documentos relacionados:** `arquitectura.md`, `planning.md` (SP-02)

## Cómo se verificó

Tres fuentes, de más a menos confiable:

1. **Prueba real** contra el backend corriendo en Docker (API de admin y base de datos).
2. **Código instalado** en `node_modules/@medusajs/*` (rutas, workflows, hooks) y los `AGENTS.md` que cada paquete trae para su versión.
3. **Documentación oficial** (`docs.medusajs.com`, añadiendo `.md` a la URL). El índice `llms.txt` devuelve 404.

Cada respuesta indica cuál de las tres la respalda.

## Resumen

| Punto | Resultado | Cambio propuesto |
|---|---|---|
| 1. Endpoints nativos | Casi todos coinciden. Hay una corrección y un riesgo de seguridad | Sí, ver 1 |
| 2. Promoción automática por porcentaje | Posible. Filtrar por medio de pago no es nativo | Sí, ver 2 |
| 3. Sesión de pago al cambiar el total | Las sesiones se borran y hay que crear una nueva | Sí, ver 3 |
| 4. Montos | Unidades de la moneda, no centavos | Solo confirmar |
| 5. Modo worker y backend | Confirmado, con otros nombres de variable | Sí, ver 5 |
| 6. Pedidos manuales para el punto de venta | Sirven como base, con un paso extra de pago | Sí, ver 6 |

## 1. Endpoints nativos (arquitectura, sección 8.2)

**Fuente:** rutas instaladas en `@medusajs/medusa/dist/api`.

Existen tal como están escritos: `GET /store/products`, `/store/products/:id`, `/store/product-categories`, `POST /store/carts`, `GET /store/carts/:id`, `POST /store/carts/:id/line-items`, `/promotions`, `/shipping-methods`, `/complete`, `POST /store/payment-collections`, `POST /store/payment-collections/:id/payment-sessions`, y en admin `/admin/products`, `/product-categories`, `/product-options`, `/promotions`, `/orders`, `/draft-orders`, `/inventory-items`.

**Corrección 1.** Quitar una promoción es `DELETE /store/carts/:id/promotions` con `promo_codes` en el cuerpo. No existe `DELETE .../promotions/:code`.

**Riesgo de seguridad 2.** `GET /store/orders/:id` **no tiene autenticación**: solo exige la clave publicable. Cualquiera que conozca el ID de un pedido ve sus datos (cliente, dirección, ítems). La tabla 8.2 lo lista como nativo con "token de acceso", pero ese token no existe en Medusa. Hay que implementarlo.

Propuesta:
- No exponer el endpoint nativo a la tienda. Reemplazarlo por una ruta propia, por ejemplo `GET /store/order-access/:token`, que devuelve solo los campos que la tienda necesita.
- El token se genera al completar el carrito, se guarda con hash y se incluye en el enlace del email (arquitectura, sección 12.3).
- Agregar el código `ORDER_TOKEN_INVALID`, que ya existe en el catálogo, a esta ruta y a las de comprobante.

**Nota 3.** El ajuste de stock (`POST /admin/products/:id/stock-adjustments`) es propio, lo que es correcto. Debe apoyarse en los endpoints nativos de niveles de inventario (`/admin/inventory-items/:id/location-levels` y `/batch`), que existen.

## 2. Promoción automática por porcentaje sobre el pedido

**Fuente:** prueba real y `AGENTS.md` de `@medusajs/promotion`.

- **Confirmado con prueba real:** `POST /admin/promotions` acepta `is_automatic: true`, `application_method.type: "percentage"`, `target_type: "order"`, `allocation: "across"`, `value: 10`.
- **No es nativo filtrar por medio de pago.** Los atributos de regla que ofrece el panel son: país, grupo de clientes, producto, categoría, colección, etiqueta, tipo, región, canal de venta y tipo de opción de envío. No hay medio de pago.
- La API aceptó crear una regla con el atributo `payment_provider`, pero eso solo prueba que no valida el nombre. **No se verificó** que se evalúe al calcular el carrito.
- Una promoción automática se aplica siempre, salvo que el workflow reciba `prevent_auto_promotions`.
- El workflow de promociones del carrito expone el hook `setPromotionContext`, que permite agregar datos al contexto de evaluación. Es la vía para llegar a `payment_provider`, sin probar todavía.

**Propuesta para HU-32.** Dos caminos, en orden de preferencia:
1. **Promoción por código aplicada por la tienda** (`TRANSFER`, no automática): la tienda la aplica al elegir transferencia y la quita al elegir tarjeta. Es el flujo que la arquitectura ya describe en sus pasos 2 y 3, y no depende de nada no verificado.
2. Promoción automática con regla sobre `payment_provider` y hook `setPromotionContext`. Solo si una prueba en HU-32 demuestra que funciona.

En ambos caminos la validación definitiva sigue siendo el hook `validate` de `completeCartWorkflow` (existe), que rechaza con `DISCOUNT_PAYMENT_MISMATCH`.

Cambio a `arquitectura.md` sección 7.1: reemplazar "promoción automática" por "promoción por código aplicada por la tienda", y dejar la automática como alternativa.

## 3. Sesión de pago al cambiar el total

**Fuente:** workflow `refreshPaymentCollectionForCartWorkflow` en `@medusajs/core-flows`.

Cuando cambia el total del carrito (por ejemplo, al aplicar o quitar la promoción de transferencia), Medusa **borra las sesiones de pago** de la colección y sincroniza el monto. Lo invocan `updateCartPromotionsWorkflow`, `refreshCartItemsWorkflow` y `createCartWorkflow`.

Consecuencia: después de aplicar o quitar la promoción, la tienda **debe crear una sesión nueva** con el proveedor elegido. No hay que reiniciar nada a mano, pero sí no reutilizar un ID de sesión anterior.

Cambio a `arquitectura.md` sección 7.3: marcar el punto como confirmado y describir el orden: elegir medio, aplicar o quitar promoción, crear sesión, completar.

## 4. Convención de montos

**Fuente:** prueba real.

Se creó una variante con precio `1500` en `ars`. La tabla `price` guarda `amount = 1500` (`raw_amount = {"value": "1500", "precision": 20}`). **Los montos están en la unidad de la moneda, no en centavos.** Coincide con el supuesto del documento. Los precios en ARS se manejan como pesos enteros.

Cambio a `arquitectura.md` sección 8.1: eliminar la frase "Verificar la convención de Medusa 2.22".

## 5. Modo de arranque de worker y backend

**Fuente:** documentación oficial (`learn/production/worker-mode.md`) y código instalado.

- La configuración es `projectConfig.workerMode` con tres valores: `shared` (un solo proceso, por defecto), `server` (solo atiende la API) y `worker` (solo jobs y subscribers).
- Para producción se recomienda **dos instancias del mismo proyecto**: una en `server` con el admin activo y otra en `worker` con el admin desactivado (`admin.disable`).
- El nombre de la variable de entorno lo elegimos nosotros al escribir `medusa-config.ts`. El proyecto usa `MEDUSA_WORKER_MODE`.
- Medusa 2.11 en adelante permite `medusa start --cluster N --servers X --workers Y`.
- Con instancias separadas, el bus de eventos y el motor de workflows **deben ser los de Redis** (ya configurados). **Es inferencia mía**, la página citada no menciona Redis.

Pendiente en HU-02: agregar `admin.disable` controlado por variable de entorno y definir las dos instancias en Coolify.

## 6. Pedidos manuales como base del punto de venta

**Fuente:** código instalado y `AGENTS.md` de `@medusajs/draft-order`.

- Los pedidos manuales (`/admin/draft-orders`) existen y vienen incluidos. El paquete solo agrega la interfaz del panel; la lógica está en el núcleo, con workflows para agregar ítems, envíos y promociones, y `convertDraftOrderWorkflow`.
- Existe `markPaymentCollectionAsPaidWorkflow`, que registra un pago manual (efectivo, transferencia en el local).

**Propuesta para HU-37.** `POST /admin/pos/sales` es un workflow propio que encadena: crear el pedido manual, convertirlo, crear la colección de pago y marcarla como pagada, todo en una transacción y con el descuento de stock del núcleo. No requiere un modelo propio de ventas.

Pendiente: verificar en HU-37 que la conversión descuenta el inventario al marcar el pago y no antes.

## Otros hallazgos

- **Roles (HU-44):** Medusa incluye un módulo `rbac`, pero es **licenciado** y está desactivado por defecto (`MEDUSA_FF_RBAC`). No es una opción para el MVP0. La decisión de un guard propio se mantiene.
- **Configuración (HU-06):** el módulo `settings` de Medusa guarda preferencias de la interfaz del panel, no configuración de negocio. `StoreSetting` propio se mantiene.
- **Mercado Pago:** Medusa solo trae el proveedor de Stripe (`payment-stripe`). SP-01 sigue pendiente.
- **Next.js:** la starter instala 16.3.8. La arquitectura fija 16.4.3, que existe en npm. Se resuelve en HU-13.
- **Node:** Medusa 2.22 exige 22.22 o superior y la starter generada declara `>=22.23.4`, con tope en v24 por la tienda. Actualizar la sección 2 de `arquitectura.md`.
- **Redis en Docker local:** el módulo de caché y el de bloqueos (`locking-redis`) existen. El bloqueo será relevante para HU-42 (sobreventa); no se configuró todavía.

## Cambios propuestos a `arquitectura.md`

| Sección | Cambio |
|---|---|
| 2 (Stack) | Node: "22.23.4, con tope en v24". |
| 7.1 | Promoción por código aplicada por la tienda; la automática queda como alternativa a validar. |
| 7.3 | Marcar los dos puntos como confirmados y describir el orden de pasos. |
| 8.1 | Quitar la verificación pendiente de montos. |
| 8.2 | Corregir `DELETE .../promotions`. Marcar `GET /store/orders/:id` como no apto para la tienda. |
| 8.3 | Agregar `GET /store/order-access/:token`. |
| 12.3 | Describir el token de pedido con hash y su generación al completar el carrito. |
| 17 | Variables `MEDUSA_WORKER_MODE` y desactivación del admin en el worker. |
