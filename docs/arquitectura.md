# Arquitectura técnica: Tienda online + punto de venta (MVP0)

**Versión:** 3.1
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Alcance actual:** desarrollo local. No hay despliegue en ningún servidor ni plataforma. La sección 21 describe cómo se prepara el código para desplegarlo más adelante.
**Documentos relacionados:** `producto.md`, `seguridad.md`, `planning.md`

> **Convenciones de este documento**
> - **[Medusa]**: viene de la plataforma, se usa sin modificaciones.
> - **[Propio]**: lo desarrollamos con las extensiones oficiales de Medusa.
> - **[Verificar]**: debe confirmarse contra la documentación y el código de la versión instalada antes de implementar. Los puntos de SP-01 están resueltos y se marcan **[Confirmado]**, con la evidencia en `sp-01-medusa.md`. Los que siguen con **[Verificar]** se resuelven en la historia indicada.
> - **[Local]** y **[Despliegue]**: indican en qué etapa aplica un elemento. Lo que no lleva marca aplica en ambas.

---

## 1. Principios

1. **Medusa primero.** Se usa lo que Medusa trae. Lo propio se agrega solo con extensiones oficiales (módulos, workflows, hooks, subscribers, rutas de API y extensiones del panel). Nunca se modifica el código de Medusa.
2. **Una instancia por cliente.** Mismo código, distinta configuración y datos. No hay multitenant.
3. **Una sola fuente de verdad por dato.** Ningún valor de negocio vive en dos lugares.
4. **El servidor decide.** Precios, totales, estados de pago y permisos se calculan y validan en el backend.
5. **Seguro por defecto.** Lo que no está permitido explícitamente está denegado. Ver `seguridad.md`.
6. **Local primero.** El MVP0 se construye y se prueba completo en local, sin cuentas ni servicios de terceros. La única excepción es la cuenta de pruebas de Mercado Pago.
7. **Portable por configuración.** Nada depende de un proveedor concreto. Las diferencias entre local y un futuro despliegue se resuelven con variables de entorno y con módulos intercambiables (almacenamiento y notificaciones). No hay URLs, dominios, rutas absolutas ni claves escritas en el código.

## 2. Stack tecnológico

| Componente | MVP0 (local) | Al desplegar (futuro) | Tipo |
|---|---|---|---|
| Backend, API y panel | Medusa.js 2.22 (TypeScript) | Igual | [Medusa] |
| Runtime | Node.js 22.22 o superior | Igual | Requisito de Medusa 2.22 |
| Base de datos | PostgreSQL en Docker | A definir (en el servidor o gestionada) | [Medusa] |
| Caché, eventos y colas | Redis en Docker | A definir | [Medusa] |
| Storefront | Next.js 16.4.3 (versión exacta, sin `^`) con `next dev` | Igual, con `next build` y `next start` | [Propio] |
| Estilos y componentes | Tailwind CSS, shadcn/ui, Phosphor Icons | Igual | [Propio] |
| Estado del storefront | Zustand (solo estado de interfaz) y TanStack Query (solo interacciones del cliente) | Igual | [Propio] |
| Catálogo de componentes | Storybook (solo storefront) | Igual | [Propio] |
| Extensiones del panel | Medusa Admin SDK y Medusa UI | Igual | [Propio] sobre [Medusa] |
| Pago con tarjeta | Mercado Pago Checkout Pro con credenciales de prueba | Credenciales de producción | Plugin o proveedor propio (SP-02) |
| Pago por transferencia | Proveedor manual de Medusa (`pp_system_default`) | Igual | [Medusa] |
| Imágenes de producto | Proveedor local de Medusa (`file-local`, registrado por defecto), carpeta `static/` | Proveedor `file-s3` hacia un almacenamiento compatible con S3 (proveedor sin decidir) | [Medusa] |
| Comprobantes | Módulo propio con driver de disco local, en una carpeta privada | Driver S3 en un bucket privado | [Propio] |
| Emails | Proveedor local de Medusa (registra en la terminal, no envía) | Proveedor real (sin decidir) | [Medusa] |
| Infraestructura | Docker Compose para PostgreSQL y Redis. Backend y storefront corren en la máquina con recarga automática. | Plataforma sin decidir (previsto: Coolify sobre una VPS, a reconfirmar) | [Despliegue] |
| Verificaciones | Script `npm run check` y hooks de Git | Integración continua en la plataforma del repositorio | [Local] y [Despliegue] |

## 3. Vista general

```
  Tu computadora (todo en localhost)

  ┌──────────────────┐        ┌────────────────────────────────────────┐
  │ Storefront       │        │ Medusa (modo compartido)    :9000      │
  │ Next.js :3000    │──API──▶│  /store  API de tienda                 │
  └──────────────────┘        │  /admin  API de admin                  │
                              │  /app    Panel y punto de venta        │
                              │  /hooks  Webhooks                      │
                              │  Jobs y suscriptores (mismo proceso)   │
                              └───────┬───────────────────┬────────────┘
                                      │                   │
                            ┌─────────▼──┐         ┌──────▼──────┐
                            │ PostgreSQL │         │ Redis       │   Docker Compose
                            │ 127.0.0.1  │         │ 127.0.0.1   │   (solo localhost)
                            └────────────┘         └─────────────┘

  Archivos locales (fuera de Git):
   ─ apps/backend/static/        Imágenes de producto. Medusa lo sirve de forma pública.
   ─ storage/private/proofs/     Comprobantes. Nunca se sirve de forma directa.

  Único servicio externo: Mercado Pago (credenciales de prueba)
```

**Reglas de esta vista:**

- Nada privado se guarda jamás en `static/`, porque Medusa expone esa carpeta públicamente.
- PostgreSQL y Redis se publican solo en `127.0.0.1`, para que nadie en la red local pueda llegar a ellos.
- Backend y storefront deben escuchar solo en localhost. **[Confirmado]** `medusa develop --host 127.0.0.1` y `next dev -H 127.0.0.1`: se comprobó que escuchan en `127.0.0.1` y no responden por la IP de la red local.
- En local, Medusa corre en un solo proceso que atiende solicitudes y también ejecuta jobs y suscriptores (modo compartido). **[Confirmado]** es el valor por defecto de `workerMode` (`shared`), sin configurar nada. Con `server` y `worker` la variable es `MEDUSA_WORKER_MODE`. La separación se prueba antes de desplegar (sección 21).

## 4. Estructura del repositorio

```
ecommerce-mvp0/
├── apps/
│   ├── backend/                 # Medusa 2.22
│   │   ├── src/
│   │   │   ├── admin/           # Extensiones del panel (Medusa UI): punto de venta,
│   │   │   │                    #   revisión de comprobantes, datos bancarios, muestra de color
│   │   │   ├── api/             # Rutas propias (/store/... y /admin/...)
│   │   │   ├── modules/
│   │   │   │   └── transfer-proof/
│   │   │   │       └── storage/ # Interfaz de almacenamiento y driver local
│   │   │   ├── workflows/       # Flujos propios y hooks sobre flujos nativos
│   │   │   ├── subscribers/     # Emails y avisos
│   │   │   └── jobs/            # Vencimiento de pedidos, conciliación de pagos
│   │   ├── static/              # Imágenes de producto (proveedor local). Fuera de Git.
│   │   ├── medusa-config.ts
│   │   └── .env.example
│   └── storefront/              # Next.js 16.4.3
│       ├── src/
│       ├── .storybook/
│       └── .env.example
├── packages/
│   └── shared-types/            # DTOs compartidos
├── scripts/
│   ├── setup-store.ts           # Configuración base, idempotente (sección 5)
│   ├── mp/simulator.mjs         # Simulador local de Mercado Pago (sección 10.4)
│   ├── mp/simulate-webhook.mjs  # Notificaciones firmadas de prueba (sección 10.4)
│   └── check.sh                 # Lint, tipos, pruebas y build
├── storage/                     # Fuera de Git
│   └── private/proofs/          # Comprobantes. Nunca se sirve de forma directa.
├── docs/
│   ├── producto.md
│   ├── arquitectura.md
│   ├── seguridad.md
│   └── planning.md
├── docker-compose.yml           # PostgreSQL y Redis
└── README.md
```

Los Dockerfiles de backend y storefront no existen en el MVP0. Se escriben en la etapa de despliegue (sección 21).

## 5. Configuración base de Medusa

Esta configuración la realiza el superadmin una sola vez por instancia. Se automatiza con `scripts/setup-store.ts`, que es idempotente (ejecutarlo dos veces no duplica nada). Así se puede recrear el entorno local desde cero en pocos minutos y, más adelante, repetir la misma configuración en un entorno desplegado.

| Elemento | Configuración | Tipo |
|---|---|---|
| Moneda | ARS como moneda por defecto de la tienda | [Medusa] |
| Región | "Argentina", país AR, moneda ARS | [Medusa] |
| Impuestos | Sin impuestos: la región fiscal de Argentina se crea sin alícuota, y los precios se marcan con impuestos incluidos para que el precio de lista sea el precio final. El comercio no usa ARCA. | [Medusa] **[Confirmado]** con las preferencias de precio (`/admin/price-preferences`) de la moneda `ars` y de la región, en `is_tax_inclusive: true`. Por defecto vienen en `false`. |
| Canales de venta | "Web" y "Local" | [Medusa] |
| Clave publicable | Una clave asociada al canal "Web", usada por el storefront | [Medusa] |
| Ubicación de stock | "Local", asociada a ambos canales | [Medusa] |
| Opciones de envío | "Retiro en el local" y "Envío a domicilio", ambas con precio 0: el costo del envío está por fuera del sistema y se coordina con el cliente | [Medusa] |
| Proveedores de pago en la región | Manual (`pp_system_default`) y Mercado Pago | [Medusa] |
| Usuarios | Superadmin, admin y vendedores | [Medusa] |

Ningún dato de catálogo (categorías, productos, talles, colores) se carga en esta configuración.

## 6. Configuración del comercio

Los datos que el admin necesita editar se guardan en la `metadata` de la entidad `Store` de Medusa, editable desde una extensión del panel. No se crea una tabla de configuración propia.

| Clave en `store.metadata` | Tipo | Valor inicial | Descripción |
|---|---|---|---|
| `bank_account` | objeto | — | Titular, CBU o CVU, alias y banco. Se muestran al cliente que paga por transferencia. |
| `transfer_reservation_hours` | entero | 24 | Horas antes de cancelar un pedido por transferencia sin comprobante aceptado. |
| `transfer_promotion_code` | string | — | Código interno de la promoción de transferencia. Solo lo lee el backend. |
| `max_units_per_variant` | entero | 5 | Unidades máximas por variante en un pedido online. |
| `admin_notification_email` | string | — | Destinatario de avisos de comprobantes. |

**Datos que no viven aquí, para no duplicarlos:**
- El **porcentaje de descuento por transferencia** vive solo en la promoción de Medusa.
- El **costo de envío** no vive en el sistema: se coordina con el cliente. Las opciones de envío de Medusa tienen precio 0 y la tienda muestra "a coordinar" para el envío a domicilio.

**[Confirmado]** la API de tienda no expone `Store` ni su `metadata` (no existe `/store/stores`). `transfer_promotion_code` puede quedar ahí.

## 7. Modelo de datos

### 7.1 Entidades nativas usadas [Medusa]

| Entidad | Uso |
|---|---|
| `Product`, `ProductOption`, `ProductOptionValue`, `ProductVariant` | Catálogo, talles, colores y variantes. Las opciones se definen por producto. |
| `ProductCategory` | Jerarquía de tres niveles. Desactivación con el campo nativo `is_active`. **[Confirmado]** su valor por defecto es `false`: una categoría nueva no se ve en la tienda hasta activarla. |
| `Price` | Precio de lista por variante. |
| `InventoryItem`, `InventoryLevel`, `ReservationItem` | Stock y reservas. |
| `SalesChannel` | "Web" y "Local". |
| `Promotion` | Descuento por transferencia y promociones del admin. |
| `Cart`, `LineItem`, `Order` | Carrito y pedidos. |
| `PaymentCollection`, `PaymentSession`, `Payment` | Pagos, capturas y reembolsos. |
| `User` | Usuarios del panel. |
| `Store` | Configuración del comercio en `metadata`. |

### 7.2 Datos propios

**Muestra de color.** Se guarda en la `metadata` del valor de opción de color: `{ "hex": "#RRGGBB" }`. **[Confirmado en HU-09]** `ProductOptionValue` tiene el campo `metadata`, pero la API de opciones no lo acepta (`sp-01-medusa.md`, punto 2). La muestra vive en el módulo propio `product-color` (`apps/backend/src/modules/product-color`), con un vínculo de uno a uno a `ProductOptionValue` (`src/links/option-value-color.ts`). La edita el admin con un widget en la ficha del producto, a través de `GET` y `POST /admin/product-colors`. Solo se asigna a valores de la opción cuyo título es "Color".

**Acceso del cliente al pedido.** Se guarda en la `metadata` del pedido:

| Clave | Descripción |
|---|---|
| `access_token_hash` | Hash SHA-256 del token. El token nunca se guarda. |
| `access_token_expires_at` | Vencimiento del token. Se fija cuando el pedido se cierra. |

**[Confirmado]** `GET /store/orders/:id` no devuelve la `metadata` del pedido, ni siquiera con `fields=metadata`. Esa ruta nativa **no tiene autenticación** y expone email, totales y dirección del cliente, así que la tienda no la usa y un middleware la bloquea con 404 (sección 13.3, HU-23).

**Comprobante de transferencia.** Módulo propio `transfer-proof`, vinculado a `Order`.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador. |
| `order_id` | string | sí | Pedido. Un pedido puede tener varios comprobantes (uno por intento). |
| `storage_key` | string | sí | Clave del archivo en el almacenamiento privado. En local, nombre del archivo dentro de `PROOFS_LOCAL_DIR`. |
| `mime_type` | string | sí | `image/jpeg`, `image/png` o `application/pdf`. |
| `size_bytes` | integer | sí | Tamaño. |
| `sha256` | string | sí | Hash del archivo, para detectar comprobantes repetidos. |
| `status` | enum | sí | `pending_review`, `accepted`, `rejected`. |
| `rejection_reason` | string | no | Motivo visible para el cliente. |
| `reviewed_by` | string | no | Usuario que revisó. |
| `reviewed_at` | datetime | no | Fecha de revisión. |
| `created_at` | datetime | sí | Fecha de subida. |

Reglas:
- Solo puede haber un comprobante `pending_review` por pedido.
- Aceptar un comprobante captura el pago del pedido en la misma operación.

## 8. Estados

No hay una máquina de estados propia. Los estados del negocio (`producto.md`, sección 8.4) se derivan de los estados nativos de Medusa y del estado del último comprobante.

| Estado para el negocio | Estado del pedido en Medusa | Estado del pago en Medusa | Último comprobante |
|---|---|---|---|
| Pendiente de pago | pendiente | autorizado o no pagado | ninguno |
| Comprobante en revisión | pendiente | autorizado o no pagado | `pending_review` |
| Comprobante rechazado | pendiente | autorizado o no pagado | `rejected` |
| Pagado | pendiente o completado | capturado | `accepted` (o ninguno, si fue con tarjeta) |
| Cancelado | cancelado | cancelado | cualquiera |
| Reembolsado | cualquiera | reembolsado total o parcial | cualquiera |

**[Confirmado]** al completar el carrito con el proveedor manual, el pedido queda `pending` y el pago `authorized`. Al cancelar, ambos pasan a `canceled`. Una captura deja el pago en `captured`.

## 9. Descuento por transferencia

### 9.1 Mecanismo

1. El admin crea en el panel una promoción de tipo porcentaje sobre el pedido, con un código largo y aleatorio. Ese código se guarda en `store.metadata.transfer_promotion_code`.
2. Cuando el cliente elige transferencia, el backend aplica la promoción al carrito con el código interno.
3. Cuando elige tarjeta, el backend la quita.
4. Al completar el carrito, un hook verifica que la promoción esté presente solo si la sesión de pago es del proveedor manual. Si no coincide, rechaza la operación con `DISCOUNT_PAYMENT_MISMATCH`.

La elección de medio de pago pasa por una ruta propia del storefront hacia el backend. El cliente nunca envía el código.

### 9.2 Por qué no una promoción automática

Las promociones automáticas se aplican cuando el carrito cumple sus condiciones, y el medio de pago se elige después. Con una promoción automática, el descuento se aplicaría también a quien paga con tarjeta.

### 9.3 Pendiente de verificación

- **[Confirmado]** al aplicar o quitar la promoción, Medusa sincroniza el monto de la colección de pago y borra sus sesiones. La ruta propia crea una sesión nueva después de cambiar la promoción.
- **[Confirmado]** quitar una promoción es `DELETE /store/carts/:id/promotions` con `promo_codes` en el cuerpo.
- **[Verificar en HU-22]** que el hook `validate` de `completeCartWorkflow` permita leer la sesión de pago elegida. El hook existe.

## 10. Pago con tarjeta (Mercado Pago)

### 10.1 Flujo

1. El storefront inicia la sesión de pago con el proveedor de Mercado Pago. El backend crea la preferencia de Checkout Pro con el total calculado por Medusa y una referencia externa propia del carrito.
2. El cliente paga en Mercado Pago y vuelve a la tienda.
3. Mercado Pago envía una notificación al webhook del backend. En local, esa notificación no llega sin URL pública y la conciliación de la sección 10.3 cumple su función (sección 10.4).
4. El backend valida la firma, consulta el pago a la API de Mercado Pago, verifica monto, moneda y referencia, y actualiza el pago (`seguridad.md`, SEC-32).
5. La página de regreso muestra el estado que consulta el backend.

### 10.2 Cuándo se crea el pedido

| Opción | Ventaja | Riesgo |
|---|---|---|
| **A.** El carrito se completa al llegar el pago aprobado | No quedan pedidos sin pagar | El stock no está reservado mientras el cliente paga. Hay que verificar stock al completar y reembolsar si ya no hay. |
| **B.** El carrito se completa antes de redirigir, con el pago pendiente | El stock queda reservado | Quedan pedidos sin pagar si el cliente abandona. Necesitan vencimiento. |

**Decisión: opción A. [Implementado y verificado con el simulador]** El proveedor de pago propio (`modules/mercadopago-payment`) crea la preferencia al elegir tarjeta. Cuando el pago aprobado se confirma (webhook, conciliación o consulta de regreso), `lib/mercadopago/settle.ts` ejecuta el flujo nativo `processPaymentWorkflow` con la acción `successful`: autoriza la sesión, captura el pago y completa el carrito, que crea el pedido. Si en ese momento no se puede crear el pedido (por ejemplo, se agotó el stock o el carrito tiene el descuento de transferencia), el pago se reembolsa por la API de Mercado Pago y se avisa al cliente por email. Un pago con monto, moneda o referencia distintos **no** se captura ni se reembolsa solo: se registra `PAYMENT_AMOUNT_MISMATCH` y lo resuelve una persona.

Se eligió un proveedor propio, y no un plugin, para controlar la validación de la firma, la verificación del monto y que el estado salga siempre de la API (SEC-32 y SEC-33). La evaluación de los plugins existentes con los criterios de SEC-81 queda pendiente en SP-02.

### 10.3 Conciliación

Un job revisa periódicamente los pagos iniciados sin resolución, consultando la API de Mercado Pago. Cubre los casos en que el webhook no llega. En local es el mecanismo principal de confirmación (sección 10.4). Al desplegar sigue activo como red de seguridad.

### 10.4 Pruebas en local

Dos límites de Mercado Pago condicionan el desarrollo local:

- Las notificaciones (webhooks) las envía Mercado Pago a una URL pública, así que no llegan a `localhost`.
- La documentación de Mercado Pago indica no usar `localhost` ni `127.0.0.1` en las URLs de retorno (`back_urls`), y recomienda un dominio con nombre o IPs de desarrollo.

Por eso las pruebas se organizan en dos niveles.

**Nivel 1: siempre disponible, sin URL pública. [Implementado]** `npm run mp:simulator` levanta un simulador local de Mercado Pago (API de preferencias, pagos, búsqueda y reembolsos, más una página de pago con «Aprobar» y «Rechazar»); se usa con `MP_API_BASE=http://localhost:9400`. `npm run mp:webhook -- --payment <id> --scenario valid|invalid-signature|expired|replay` envía notificaciones firmadas.

1. **Notificaciones simuladas.** `scripts/mp/simulate-webhook.mjs` envía al backend local notificaciones con una firma generada con un secreto de prueba local (no el de Mercado Pago). Permite probar firma válida, firma inválida, notificación vencida, notificación repetida y monto distinto.
2. **Conciliación.** El job de la sección 10.3 consulta a la API de Mercado Pago, con credenciales de prueba, los pagos pendientes. En local es el mecanismo principal de confirmación: permite completar un pago real de sandbox sin URL pública.
3. **Retorno manual.** Después de pagar en el sitio de Mercado Pago, la persona vuelve a mano a la página del pedido, que muestra el estado consultado al backend (SEC-33).
4. **URLs opcionales.** `MP_NOTIFICATION_URL` y `MP_BACK_URL_BASE` son opcionales: si no están definidas, la preferencia se crea sin ellas.

**Nivel 2: opcional, verificación real de extremo a extremo.**

Un túnel temporal que exponga el backend local con un nombre público y HTTPS, usado solo mientras dura la prueba. Es una herramienta de desarrollo, no un despliegue. Las opciones conocidas son ngrok y Cloudflare Tunnel. Los requisitos de cuenta y las condiciones de cada una se verifican al elegir.

**Se verifica en SP-02:**

- Qué ocurre al crear la preferencia sin `back_urls` o sin `notification_url`.
- Si Mercado Pago acepta un alias de host local (por ejemplo `tienda.test`) o una IP de la red local en `back_urls`.
- Qué plugin, o qué proveedor propio, permite configurar esas dos URLs por variables de entorno.

**Límite que se asume.** El comportamiento real de los webhooks de Mercado Pago (reintentos, orden de eventos, firma real) no se puede confirmar sin una URL pública. Esa verificación es la historia HU-51 de la etapa de despliegue.

## 11. Pago por transferencia

1. El cliente elige transferencia. Se aplica la promoción (sección 9) y se inicia la sesión con el proveedor manual.
2. El carrito se completa y se crea el pedido con el pago pendiente. El stock queda reservado por las reservas nativas de Medusa.
3. Se genera el token de acceso al pedido y se envía el email con los datos bancarios.
4. El cliente sube el comprobante (`POST /store/order-access/:id/transfer-proofs`).
5. El admin revisa el comprobante en una extensión del panel:
   - **Aceptar:** el comprobante pasa a `accepted` y se captura el pago con el flujo nativo de Medusa.
   - **Rechazar:** el comprobante pasa a `rejected` con motivo. El pedido sigue pendiente.
6. Un job cancela los pedidos por transferencia sin comprobante aceptado después de `transfer_reservation_hours`, usando la cancelación nativa. **[Confirmado]** la cancelación nativa libera las reservas de stock.

Un pedido con un comprobante en revisión no se cancela por vencimiento hasta que el admin lo revise.

## 12. Punto de venta

- Es una **ruta propia dentro del panel de Medusa**, construida con Medusa Admin SDK y Medusa UI. No usa shadcn ni el storefront.
- Cada venta se crea en el canal "Local", con el proveedor manual y el pago capturado en el mismo paso.
- **[Confirmado]** los pedidos borrador sirven como base: borrador, conversión a pedido, colección de pago y `mark-as-paid` dejan el pago `captured` (`sp-01-medusa.md`, punto 8).
- **[Verificar en HU-34]** el stock físico no baja al cobrar, solo queda reservado. La venta del local debe además registrar el despacho para descontarlo.
- El reporte de ventas del día filtra pedidos por canal "Local" y fecha.

## 13. Endpoints

### 13.1 Convenciones

- **Tienda:** header `x-publishable-api-key` con la clave del canal "Web".
- **Admin:** sesión o token de usuario autenticado.
- **Cliente invitado:** token de acceso al pedido en el header `x-order-token`.
- Formato JSON, fechas ISO 8601 en UTC.
- **[Confirmado]** los montos están en la unidad de la moneda (1500 es 1500 pesos), no en centavos.

### 13.2 Endpoints nativos usados [Medusa]

**[Confirmado]** todas estas rutas existen en Medusa 2.22 (`sp-01-medusa.md`). `GET /store/orders/:id` también existe, pero no está en esta lista a propósito: no tiene autenticación y se bloquea.

**Tienda**

| Método | Ruta | Uso |
|---|---|---|
| GET | `/store/products` | Listado y búsqueda. |
| GET | `/store/products/:id` | Detalle con opciones y variantes. |
| GET | `/store/product-categories` | Árbol de categorías. |
| GET | `/store/regions` | Región y moneda. |
| POST | `/store/carts` | Crear carrito. |
| GET / POST | `/store/carts/:id` | Obtener y actualizar carrito (email, direcciones). |
| POST | `/store/carts/:id/line-items` | Agregar variante. |
| POST / DELETE | `/store/carts/:id/line-items/:line_id` | Cambiar cantidad o quitar. |
| GET | `/store/shipping-options` | Opciones de envío del carrito. |
| POST | `/store/carts/:id/shipping-methods` | Elegir retiro o envío. |
| GET | `/store/payment-providers` | Proveedores de la región. |
| POST | `/store/payment-collections` | Crear colección de pago. |
| POST | `/store/payment-collections/:id/payment-sessions` | Iniciar sesión de pago. |
| POST | `/store/carts/:id/complete` | Completar carrito y crear pedido. |

La aplicación y quita de promociones no se expone al cliente. La hace el backend (sección 9).

**Admin:** el panel de Medusa usa sus propias rutas para productos, categorías, opciones, inventario, promociones, pedidos, pagos, reembolsos, usuarios y canales. No se documentan aquí porque no las consume código propio, salvo las que usen las extensiones del panel.

### 13.3 Endpoints propios [Propio]

**Tienda**

| Método | Ruta | Autenticación | Uso |
|---|---|---|---|
| POST | `/store/checkout/:cart_id/payment-method` | Clave publicable | Elegir tarjeta o transferencia. Aplica o quita la promoción e inicia la sesión de pago. |
| GET | `/store/checkout/bank-account` | Clave publicable | Datos bancarios para mostrar en el checkout. |
| GET | `/store/checkout/transfer-discount` | Clave publicable | Porcentaje de descuento por transferencia, leído de la promoción de Medusa, para mostrar el precio en el listado, el detalle y el carrito. Devuelve solo `{ "percent": 10 }`: el código de la promoción nunca sale. **[Confirmado en HU-13]** |
| GET | `/store/product-colors` | Clave publicable | Muestras de color de los valores de la opción Color de un producto (`?product_id=`). Las lee la ficha de producto. **[Confirmado en HU-14]** |
| POST | `/store/checkout/:cart_id/complete` | Clave publicable | Confirma el pedido por transferencia. Es el único camino para completar un carrito: la ruta nativa `POST /store/carts/:id/complete` y todo `/store/orders*` responden `ORDER_ACCESS_DENIED`. Devuelve `{ order_id, display_id, token }`; el token se muestra una sola vez y en la base queda su hash. Errores: `PAYMENT_METHOD_REQUIRED` (422), `PAYMENT_PROVIDER_UNAVAILABLE` (503), `CHECKOUT_INCOMPLETE` (422), `CART_ALREADY_COMPLETED` (409), `PENDING_ORDERS_LIMIT` (429). **[Confirmado en HU-23 y HU-27]** |
| GET | `/store/order-access/:id` | Token del pedido | Detalle del pedido para el cliente invitado. |
| POST | `/store/order-access/:id/transfer-proofs` | Token del pedido | Subir comprobante. |
| GET | `/store/order-access/:id/transfer-proofs` | Token del pedido | Estado del último comprobante y motivo de rechazo. |
| GET | `/store/checkout/:cart_id/payment-status` | Clave publicable | Estado del pago con tarjeta al volver de Mercado Pago. Concilia consultando a Mercado Pago; si el pedido ya existe devuelve su id y un token de acceso. Nunca lee la URL de regreso (SEC-33). **[Confirmado en HU-24]** |
| POST | `/hooks/mercadopago` | Firma de Mercado Pago | Webhook propio. Valida la firma (HMAC SHA256, comparación en tiempo constante, ventana de 5 minutos) antes de procesar: inválida → 401 `WEBHOOK_SIGNATURE_INVALID`. Consulta el pago a la API y verifica monto, moneda y referencia; repetirla no duplica nada. La ruta nativa `/hooks/payment/:provider` de Medusa no sirve porque responde 200 antes de validar. **[Confirmado en HU-25]** |

**Admin**

| Método | Ruta | Rol | Uso |
|---|---|---|---|
| GET | `/admin/transfer-proofs` | admin, vendedor (lectura) | Cola de comprobantes, filtrable por estado. |
| GET | `/admin/transfer-proofs/:id/url` | admin, vendedor (lectura) | Enlace firmado de 15 minutos. |
| GET | `/admin/transfer-proofs/:id/file` | admin, vendedor (lectura) | Entrega el archivo con el driver local, validando el token firmado y la sesión. Con el driver S3 no se usa. |
| POST | `/admin/transfer-proofs/:id/accept` | admin | Aceptar y capturar el pago. |
| POST | `/admin/transfer-proofs/:id/reject` | admin | Rechazar con motivo. |
| GET / PATCH | `/admin/store-settings` | admin | Leer y editar las claves de `store.metadata` de la sección 6. |
| POST | `/admin/pos/sales` | admin, vendedor | Registrar venta en el local. |
| GET | `/admin/pos/sales/summary` | admin | Totales del día por medio de pago. |

## 14. Payloads y DTOs

Los DTOs se definen en `packages/shared-types` y se validan en el backend con el validador de Medusa o con Zod.

### 14.1 Elegir medio de pago

`POST /store/checkout/:cart_id/payment-method`

```json
{ "method": "transfer" }
```

| Campo | Tipo | Valores |
|---|---|---|
| `method` | enum | `card`, `transfer` |

Respuesta:

```json
{
  "cart": { "id": "cart_01", "subtotal": 30000, "discount_total": 3000, "total": 27000 },
  "payment_session": { "provider_id": "pp_system_default", "status": "pending" }
}
```

Con `card`, la respuesta incluye los datos necesarios para redirigir a Checkout Pro.

**[Confirmado en HU-21 y HU-22]**
- Con `transfer` el backend aplica la promoción con el código interno, descarta las sesiones de otro proveedor y crea la sesión de `pp_system_default`. Con `card` quita la promoción. Repetir el mismo medio no cambia nada.
- Todavía no hay proveedor de tarjeta (HU-24): con `card` la respuesta trae `payment_session: null`. La elección se guarda en `cart.metadata.payment_method`.
- Los montos de `cart` salen como números en la unidad de la moneda. El descuento alcanza solo a los productos, no al envío.
- Cuerpo inválido (otro valor o campos extra) responde 400; un carrito inexistente o completado, 404; sin código de promoción configurado, `PAYMENT_PROVIDER_UNAVAILABLE`.
- **El código nunca sale por la API de tienda.** Medusa devuelve `promotions.code` y `items.adjustments.code` dentro del carrito, así que un middleware sobre `/store*` (`lib/transfer-discount/scrub-middleware.ts`) borra el código de toda respuesta. Se lee de la configuración y se guarda 10 segundos en memoria, de modo que un cambio de código tarda hasta 10 segundos en regir en la depuración.
- **Último control:** el hook `validate` de `completeCartWorkflow` vuelve a leer el carrito y rechaza con `DISCOUNT_PAYMENT_MISMATCH` si tiene la promoción y alguna sesión de pago no es del proveedor manual.

### 14.2 Subir comprobante

`POST /store/order-access/:id/transfer-proofs` · `multipart/form-data` · header `x-order-token`

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `file` | archivo | sí | JPG, PNG o PDF por contenido, máximo 5 MB. |

Respuesta:

```json
{
  "transfer_proof": {
    "id": "tp_01",
    "status": "pending_review",
    "created_at": "2026-10-23T15:30:00Z"
  }
}
```

### 14.3 Rechazar comprobante

`POST /admin/transfer-proofs/:id/reject`

```json
{ "reason": "El monto del comprobante no coincide con el total del pedido." }
```

El motivo tiene entre 10 y 300 caracteres y es visible para el cliente.

### 14.4 Aceptar comprobante

`POST /admin/transfer-proofs/:id/accept`

```json
{ "note": "Acreditado el 23/10" }
```

La nota es opcional e interna. Aceptar captura el pago del pedido.

### 14.5 Venta en el local

`POST /admin/pos/sales`

```json
{
  "items": [
    { "variant_id": "variant_01", "quantity": 2 },
    { "variant_id": "variant_02", "quantity": 1 }
  ],
  "payment_method": "cash",
  "customer": { "name": "Ana Pérez", "document": null },
  "note": null
}
```

| Campo | Tipo | Requerido | Valores |
|---|---|---|---|
| `items` | array | sí | Al menos un elemento. |
| `items[].variant_id` | string | sí | Variante existente, publicada y con stock. |
| `items[].quantity` | integer | sí | Mayor que 0. |
| `payment_method` | enum | sí | `cash`, `transfer`, `card` (se guarda como dato de la venta). |
| `customer` | objeto | no | Nombre y documento opcionales. |
| `note` | string | no | Hasta 300 caracteres. |

Respuesta:

```json
{
  "sale": {
    "order_id": "order_01",
    "sales_channel": "Local",
    "total": 18500,
    "payment_method": "cash",
    "created_at": "2026-10-23T16:02:11Z"
  }
}
```

### 14.6 Configuración del comercio

`PATCH /admin/store-settings`

```json
{
  "bank_account": {
    "holder": "Nombre del comercio",
    "cbu": "0000000000000000000000",
    "alias": "comercio.alias",
    "bank": "Banco"
  },
  "transfer_reservation_hours": 24,
  "max_units_per_variant": 5,
  "admin_notification_email": "dueno@comercio.com"
}
```

Validaciones: CBU o CVU de 22 dígitos; alias de 6 a 20 caracteres con letras, números, puntos o guiones; horas de reserva entre 1 y 72; unidades por variante entre 1 y 50.

## 15. Errores

### 15.1 Formato

```json
{
  "type": "invalid_data",
  "code": "TRANSFER_PROOF_TOO_LARGE",
  "message": "El comprobante supera 5 MB. Comprimí la imagen o subí un PDF.",
  "details": { "max_mb": 5 }
}
```

| Campo | Descripción |
|---|---|
| `type` | Tipo de error de Medusa. |
| `code` | Código propio, estable, para el storefront y el panel. |
| `message` | Texto en español que explica qué pasó y cómo seguir. |
| `details` | Datos adicionales. Nunca incluye información interna ni de otros pedidos. |

### 15.2 Catálogo

| Código | HTTP | Cuándo | Cómo se recupera el usuario |
|---|---|---|---|
| `STOCK_INSUFFICIENT` | 400 | No hay stock suficiente. | Reducir la cantidad o elegir otra variante. |
| `MAX_UNITS_EXCEEDED` | 400 | Supera el máximo de unidades por variante. | Reducir la cantidad o comprar en el local. |
| `VARIANT_UNAVAILABLE` | 400 | Variante despublicada o sin precio. | Elegir otra combinación. |

**[Confirmado en HU-18]** estos tres errores salen de los hooks `validate` de agregar y cambiar cantidad. Medusa los responde con HTTP 400 (no permite fijar otro estado sin perder el `code`), así que el contrato es el campo `code`. El campo `message` es un JSON con el detalle: `{"available": 3}` para `STOCK_INSUFFICIENT`, `{"max_units_per_variant": 5}` para `MAX_UNITS_EXCEEDED`. Una variante sin precio la rechaza Medusa por su cuenta con otro mensaje.
| `DISCOUNT_PAYMENT_MISMATCH` | 422 | Descuento de transferencia con otro medio de pago. | Volver a elegir el medio de pago. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | Mercado Pago no responde. | Reintentar o pagar por transferencia. |
| `PAYMENT_AMOUNT_MISMATCH` | 409 | El monto pagado no coincide con el pedido. | Interno: se registra y el admin revisa. |
| `ORDER_ALREADY_PAID` | 409 | El pedido ya está pagado. | Ver el estado del pedido. |
| `ORDER_EXPIRED` | 409 | El pedido venció antes de aceptar un comprobante. | Hacer un pedido nuevo. |
| `ORDER_ACCESS_DENIED` | 404 | Token inválido o vencido. | Usar el enlace del email. No revela si el pedido existe. |
| `PENDING_ORDERS_LIMIT` | 429 | Superó el límite de pedidos pendientes. | Completar o esperar el vencimiento de un pedido anterior. |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes. | Esperar y reintentar. |
| `IMAGE_TOO_LARGE` | 413 | Imagen de producto mayor a 5 MB. | Comprimirla o elegir una más liviana. |
| `IMAGE_FORMAT_INVALID` | 415 | La imagen no es JPG, PNG o WebP, o su contenido no coincide con su extensión. | Subir una imagen JPG, PNG o WebP. |
| `TRANSFER_PROOF_TOO_LARGE` | 413 | Archivo mayor a 5 MB. | Comprimir o subir PDF. |
| `TRANSFER_PROOF_FORMAT_INVALID` | 415 | Formato no permitido. | Subir JPG, PNG o PDF. |
| `TRANSFER_PROOF_PENDING` | 409 | Ya hay un comprobante en revisión. | Esperar la revisión. |
| `TOO_MANY_UPLOADS` | 429 | Más de 5 comprobantes subidos en una hora para un mismo pedido. | Esperar y volver a intentar. |
| `PROOF_LINK_INVALID` | 403 | El enlace firmado del comprobante venció o fue alterado. | Volver a abrir el comprobante desde la lista del panel. |
| `TRANSFER_PROOF_NOT_REVIEWABLE` | 409 | El comprobante ya fue revisado. | Revisar el estado actual. |
| `REJECTION_REASON_REQUIRED` | 422 | Motivo de rechazo inválido. | Escribir un motivo de 10 a 300 caracteres. |
| `SALE_ITEMS_EMPTY` | 422 | Venta sin productos. | Agregar al menos un producto. |
| `SETTING_INVALID` | 422 | Valor de configuración inválido. | Corregir el campo indicado. |
| `STORE_UNAVAILABLE` | 503 | La tienda no pudo consultar al servidor (red caída o error del servidor). Es un aviso de la tienda, no de la API. | Reintentar en unos segundos. |
| `COLOR_INVALID` | 422 | El color no tiene el formato `#RRGGBB`, o el valor no es de la opción Color. | Corregir el color. |
| `PRODUCT_MULTIPLE_CATEGORIES` | 400 | Un producto quedaría en más de una categoría. | Dejarlo en una sola categoría o subcategoría. |
| `ROLE_NOT_ALLOWED` | 403 | El rol no tiene permiso para la acción. | Pedir el permiso al admin. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Firma de Mercado Pago inválida. | No aplica al usuario. Se registra y se descarta. |
| `CARD_PAYMENT_REQUIRED` | 422 | Se intentó confirmar a mano un pedido con tarjeta. | Pagar desde Mercado Pago: el pedido se crea al llegar el pago. |

## 16. Autenticación y autorización

### 16.1 Tipos de acceso

| Quién | Mecanismo | Detalle |
|---|---|---|
| Superadmin, admin y vendedor | Usuario y contraseña de Medusa | **[Confirmado]** el login devuelve un JWT y `POST /auth/session` crea una sesión por cookie `HttpOnly` de 10 horas por defecto. En `production` y `staging` es `Secure` y `SameSite=Lax`; en desarrollo no. |
| Storefront | Clave publicable del canal "Web" | Identifica la tienda. Es pública y no da acceso a datos privados. |
| Cliente comprando | Sin cuenta | El identificador del carrito vive en una cookie `HttpOnly` del storefront. |
| Cliente consultando su pedido | Token de acceso al pedido | Ver `seguridad.md`, SEC-24. |

### 16.2 Roles

- **[Confirmado]** los roles y políticas nativos (`@medusajs/rbac`) son un módulo con licencia y están desactivados por defecto. No se usan en el MVP0.
- **Decisión:** guard propio sobre `/admin/*` con lista de rutas permitidas para el vendedor y **denegación por defecto**.
- **Implementación [Confirmado]:** el rol vive en `user.metadata.role` (`superadmin`, `admin` o `vendedor`) y se asigna con `npm run user:role`. Un usuario sin rol, o con un valor desconocido, es vendedor. El middleware está en `apps/backend/src/lib/roles/` y se registra con el matcher de texto `'/admin*'`. Responde `ROLE_NOT_ALLOWED` (403) y registra el rechazo (SEC-95). El superadmin hace todo; el admin lee, pero no modifica, regiones, impuestos, proveedores de pago, claves de API ni la tienda de Medusa (SEC-22); el vendedor solo consulta productos, stock, pedidos y comprobantes, y registra ventas.
- En ambos casos, cada ruta del admin tiene una prueba automatizada por rol.
- **Limitación conocida [Confirmado]:** el menú del panel muestra todas las secciones (clientes, promociones, listas de precios, botones de crear) aunque el vendedor no pueda usarlas; al entrar en una, el panel muestra un error de permiso. Se documenta para el dueño y se evalúa ocultarlas con extensiones del panel.
- Para que el panel cargue, el vendedor puede **leer** `/admin/stores` (sin `metadata`, donde están el CBU y el código de la promoción), `/admin/layouts`, `/admin/regions`, `/admin/sales-channels` y `/admin/feature-flags`. `/admin/notifications` queda denegada porque los avisos futuros pueden contener enlaces con token.

## 17. Almacenamiento

### 17.1 Base de datos

PostgreSQL es la única fuente de verdad. En local corre en Docker con un volumen propio. Las migraciones se hacen con las herramientas de Medusa. `docker compose down -v` destruye los datos y permite empezar desde cero.

Los datos de desarrollo son descartables y **nunca incluyen datos reales de clientes**.

### 17.2 Imágenes de producto [Medusa] [Local]

- Se usa el proveedor local de Medusa, que viene registrado por defecto. Guarda los archivos en `apps/backend/static/` y los sirve de forma pública.
- La URL base se toma de `MEDUSA_BACKEND_URL`.
- Regla: **nada privado se guarda en `static/`**.
- Se validan formato (JPG, PNG o WebP), contenido real del archivo y tamaño máximo de 5 MB (SEC-50). **[Confirmado]** Medusa no valida nada al subir: aceptó un texto con extensión `.png`, un HTML, un `.exe` y un archivo de 6 MB. Hace falta un middleware propio (HU-05).
- **[Confirmado]** el proveedor local arma las URLs con su propia opción `backend_url` (por defecto `http://localhost:9000/static`) y **no** lee `MEDUSA_BACKEND_URL`. `medusa-config.ts` la define como `${MEDUSA_BACKEND_URL}/static` (HU-05).
- El storefront usa `next/image`. **[Confirmado]** Next.js 16.4.3 rechaza optimizar imágenes de `localhost` (error "resolved to private IP"). Se resuelve con `images.dangerouslyAllowLocalIP: true` y `remotePatterns` con el host y la ruta `/static/**` tomados de `NEXT_PUBLIC_IMAGES_HOST`, **solo cuando ese host es `localhost` o `127.0.0.1`** (también en el build de producción probado en la máquina). Con un dominio real no se activa y se exige https (HU-05, HU-12, HU-13).
- Las URLs guardadas en local (`http://localhost:9000/static/...`) no sirven fuera de la máquina. Por eso el catálogo de prueba no se promueve a un entorno desplegado (sección 20.4).

### 17.3 Comprobantes [Propio]

El módulo de archivos de Medusa acepta un solo proveedor y está pensado para archivos públicos, así que los comprobantes se guardan con un módulo propio, que escribe a través de una interfaz intercambiable:

```ts
interface ProofStorage {
  put(key: string, data: Buffer, mime: string): Promise<void>
  getAccessUrl(
    key: string,
    ttlSeconds: number,
    ctx: { proofId: string; userId: string }
  ): Promise<string>
  remove(key: string): Promise<void>
}
```

**Driver local (MVP0).**

- Guarda en `PROOFS_LOCAL_DIR` (por defecto `storage/private/proofs/`), fuera de `static/` y fuera del alcance de cualquier ruta pública.
- La clave es un identificador aleatorio generado por el sistema, sin el nombre original ni extensión. El tipo se guarda en la base de datos.
- `getAccessUrl` devuelve la URL de la ruta `GET /admin/transfer-proofs/:id/file` con un token firmado (HMAC con `PROOFS_URL_SIGNING_SECRET`) que incluye el comprobante, el usuario y un vencimiento de 15 minutos.
- Esa ruta exige además una sesión de admin, o de vendedor con permiso de lectura. Entrega el archivo con `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` y `Content-Security-Policy: sandbox`, para que un archivo malicioso no pueda ejecutarse en el contexto del panel (mismo origen).

**Driver S3 (etapa de despliegue).** Se agrega en TEC-04. `getAccessUrl` devuelve un enlace firmado del proveedor con el mismo vencimiento. El contrato de la interfaz no cambia.

**Validaciones al subir (SEC-51):** tipo real por el contenido (JPG, PNG o PDF), máximo 5 MB, hash SHA-256 guardado para detectar archivos repetidos.

**Pruebas de contrato.** Cualquier driver debe pasar la misma batería de pruebas. El driver S3 se suma a esa batería cuando exista.

### 17.4 Respaldos

No aplican en local. Ver la sección 21 y `seguridad.md`, SEC-90.

### 17.5 Variables de entorno

**Backend (`apps/backend/.env`)**

```
NODE_ENV=development
MEDUSA_BACKEND_URL=http://localhost:9000
DATABASE_URL=postgres://postgres:<clave-local>@127.0.0.1:5432/medusa_dev
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=                    # generado en cada máquina
COOKIE_SECRET=                 # generado en cada máquina
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000
AUTH_CORS=http://localhost:9000,http://localhost:3000

# Comprobantes
PROOFS_STORAGE_DRIVER=local
PROOFS_LOCAL_DIR=../../storage/private/proofs
PROOFS_URL_SIGNING_SECRET=     # generado en cada máquina

# Mercado Pago (solo credenciales de prueba)
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=    # en local: secreto de prueba para el simulador
MP_NOTIFICATION_URL=           # vacío si no hay URL pública
MP_BACK_URL_BASE=              # opcional. Ver sección 10.4
```

**Storefront (`apps/storefront/.env.local`)**

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=
NEXT_PUBLIC_IMAGES_HOST=localhost:9000
```

**Variables que se agregan al desplegar** (no se usan en el MVP0): endpoint, bucket y claves de almacenamiento S3 para imágenes y comprobantes, `PROOFS_STORAGE_DRIVER=s3`, credenciales del proveedor de email, variables del modo servidor y worker, credenciales del bucket de respaldos, CORS con los dominios reales y credenciales de producción de Mercado Pago.

## 18. Storefront

- Se construye **desde cero** con Next.js 16.4.3 y el SDK de JavaScript de Medusa, usando el starter oficial solo como referencia. El starter tiene su propio stack, que no coincide con el elegido.
- **Server Components** para catálogo, categorías y detalle de producto.
- **Server Actions** para modificar el carrito y elegir el medio de pago.
- El **carrito vive en Medusa**. El storefront solo guarda su identificador en una cookie `HttpOnly`.
- **TanStack Query** solo para datos que se consultan desde el navegador después de cargar la página, como el estado del comprobante en la página del pedido.
- **Zustand** solo para estado de interfaz: apertura del carrito lateral, filtros en edición y preferencias visuales. Nunca para precios, stock ni contenido del carrito.
- **Storybook** documenta los componentes del storefront.
- En desarrollo corre con `next dev`. Antes de dar por terminada una historia se verifica también el build de producción con `next build` y `next start`, para detectar diferencias de comportamiento.
- La cookie `Secure` se exige al desplegar con HTTPS. En local se desactiva por configuración, porque no hay HTTPS.

## 19. Notificaciones

| Evento | Destinatario | Contenido |
|---|---|---|
| Pedido por transferencia creado | Cliente | Datos bancarios, monto, referencia, vencimiento y enlace al pedido. |
| Pedido pagado | Cliente | Confirmación, ítems, total y enlace al pedido. |
| Comprobante recibido | Admin | Enlace a la cola de revisión. |
| Comprobante rechazado | Cliente | Motivo y enlace para subir otro. |
| Pedido cancelado | Cliente | Motivo (vencimiento o cancelación del comercio). |

**En local** se usa el proveedor de notificaciones local de Medusa, que viene registrado por defecto y solo registra el contenido en la terminal, sin enviar nada. Hay que configurarle el canal `email`. Las plantillas se verifican con pruebas de renderizado y con una vista previa en el navegador (`npm run email:preview`). Los envíos pasan por `sendEmail` (`apps/backend/src/lib/notifications/`): arma el email con la plantilla base, lo manda por el canal `email`, reintenta 3 veces con espera creciente y, si todo falla, registra `email_failed` / `email_gave_up` sin destinatario ni datos del cliente y devuelve `false` para no romper el pedido. `npm run email:preview` abre `http://127.0.0.1:3900` con cada plantilla y datos de ejemplo.

**Al desplegar** se elige un proveedor real de emails (TEC-05). Los envíos se hacen desde suscriptores, con reintentos, y los fallos quedan registrados. Mientras no haya despliegue, el MVP0 no envía ningún email real.

## 20. Entorno local de desarrollo

### 20.1 Requisitos

Node.js 22.22 o superior, Docker con Compose, Git y el gestor de paquetes del proyecto (npm).

### 20.2 Servicios

`docker-compose.yml` levanta solo PostgreSQL y Redis:

- Puertos publicados únicamente en `127.0.0.1`, para que no sean accesibles desde la red local.
- Volúmenes con nombre para conservar los datos entre reinicios.
- Healthchecks, para que el backend arranque cuando ambos estén listos.

Backend y storefront corren en la máquina, con recarga automática.

### 20.3 Comandos

Los nombres exactos se fijan en HU-01.

```
docker compose up -d        # PostgreSQL y Redis
npm install
npm run setup:store         # configuración base (idempotente)
npm run dev                 # backend en :9000 y storefront en :3000
npm run check               # lint, tipos, pruebas y build
docker compose down -v      # destruye los datos y reinicia desde cero
```

### 20.4 Datos de desarrollo

- Son descartables y no incluyen datos reales de clientes.
- No se promueven a un entorno desplegado. Al desplegar se carga el catálogo real.
- Si algún día hiciera falta migrar datos, se hace con un script específico, que queda fuera de este alcance.

### 20.5 Primer usuario

Se crea con la CLI de Medusa. **[Confirmado]** `npx -w @aloe/backend medusa user -e <email> -p <contraseña>`. No hay credenciales por defecto compartidas.

### 20.6 Secretos locales

- `.env` no se versiona. `.env.example` sí, sin valores reales.
- `JWT_SECRET`, `COOKIE_SECRET` y `PROOFS_URL_SIGNING_SECRET` se generan de forma aleatoria en cada máquina.
- Un hook de Git bloquea el commit de archivos `.env` y de patrones de claves (SEC-10).
- Las credenciales de prueba de Mercado Pago se guardan en el gestor de contraseñas.

### 20.7 Verificaciones

`npm run check` ejecuta lint, tipos, pruebas, build y auditoría de dependencias. Un hook de pre-push ejecuta las verificaciones rápidas (TEC-01).

## 21. Etapa de despliegue (posterior al MVP0)

Nada de esta sección se construye en el MVP0. Describe qué se decide más adelante y qué se prepara desde ahora para que desplegar sea simple. El detalle de tickets está en `planning.md`, sección "Etapa de despliegue".

### 21.1 Qué se decide entonces

| Tema | Opciones conocidas | Nota |
|---|---|---|
| Plataforma de despliegue | Previsto: Coolify sobre una VPS. Se reconfirma. | Si se elige una VPS, aplican SEC-01 a SEC-05. |
| Almacenamiento externo | Cloudflare R2, Backblaze B2, Tigris u otro compatible con S3 | R2 requiere un medio de pago. Se prueba la compatibilidad con el proveedor `file-s3` de Medusa y con el driver S3 antes de adoptarlo. |
| Emails | A elegir | Dominio de envío con SPF, DKIM y DMARC. |
| Dominio y DNS | A definir con el dueño | Para `.com.ar`, NIC Argentina pide CUIT o CUIL y Clave Fiscal. |
| Acceso al panel de la plataforma | VPN o lista de IPs permitidas | Ver SEC-02. El plan gratuito de Tailscale es solo para uso no comercial. |
| Respaldos | Bucket exclusivo, cifrado | Ver SEC-90. |
| Integración continua | La del repositorio elegido | Ver TEC-06. |

### 21.2 Qué cambia respecto del entorno local

| Aspecto | Local | Despliegue |
|---|---|---|
| URLs y CORS | `localhost` | Dominios exactos |
| Transporte | HTTP | HTTPS con HSTS y cookies `Secure` |
| Imágenes | Proveedor `file-local` | Proveedor `file-s3` con dominio propio |
| Comprobantes | Driver local | Driver S3 con enlaces firmados |
| Emails | Proveedor local (registra en terminal) | Proveedor real |
| Mercado Pago | Credenciales de prueba, conciliación como mecanismo principal | Credenciales de producción y webhook público verificado |
| Procesos de Medusa | Modo compartido | Servidor y worker separados |
| Base de datos y Redis | Docker local | Servicio con respaldos |
| Secretos | `.env` local | Variables de la plataforma, distintas por entorno |

### 21.3 Qué se prepara desde ahora

- Todas las URLs, dominios, rutas y claves salen de variables de entorno (sección 17.5).
- Almacenamiento y notificaciones son intercambiables, con pruebas de contrato.
- El build de producción de backend y storefront se verifica en local (HU-46).
- Las URLs de Mercado Pago (`notification_url` y `back_urls`) se configuran por variables.
- Antes de desplegar se prueba en local la separación en servidor y worker (TEC-03).
- El código no asume nada del sistema operativo local (rutas con `path`, sin separadores fijos).

### 21.4 Plan previsto, a reconfirmar

Es el plan de la versión anterior de este documento, que se mantiene solo como referencia.

- Cinco servicios en un mismo proyecto de Coolify: storefront, servidor de Medusa, worker de Medusa (misma imagen del backend), PostgreSQL y Redis.
- Entornos de staging y producción separados, con secretos distintos.
- Proceso: integración continua, despliegue automático a staging, producción de forma manual desde una versión etiquetada, migraciones antes de arrancar y la imagen anterior conservada para volver atrás.
- Recursos orientativos: entre 4 y 8 GB de RAM para todo en un solo servidor, a validar con mediciones.

## 22. Observabilidad

**En local (MVP0):**

- Logs estructurados en JSON en la terminal, con identificador de solicitud y de pedido, sin datos personales (SEC-70).
- Nivel de log configurable por variable de entorno.
- Registro de los eventos de seguridad de SEC-95.

**Al desplegar:** métricas (pedidos por hora, pagos aprobados y rechazados, comprobantes pendientes, errores 5xx), monitoreo externo de disponibilidad y alertas (SEC-96). Ver HU-52.

## 23. Pruebas

Todas las pruebas se ejecutan en local.

| Tipo | Alcance | Herramienta |
|---|---|---|
| Unitarias | Validaciones, derivación de estados, cálculo de límites | Vitest o Jest |
| Integración | Rutas propias, hook de descuento, webhook simulado, permisos por rol, contrato del almacenamiento | Pruebas de integración de Medusa |
| Extremo a extremo | Compra con tarjeta (sandbox), compra por transferencia, venta en el local, vencimiento, rechazo | Playwright |
| Concurrencia | Compras simultáneas de la última unidad | k6 |
| Build de producción | Backend y storefront con `NODE_ENV=production` ejecutándose en local | Scripts |

Criterios mínimos antes de dar el MVP0 por terminado: ningún stock negativo, ningún descuento de transferencia cobrado con tarjeta, ningún pago procesado dos veces y el checklist 6.1 de `seguridad.md`.

**Pendiente para el despliegue:** la verificación con notificaciones reales de Mercado Pago (HU-51) y el checklist 6.2 de `seguridad.md`.

## 24. Seguridad

El modelo de amenazas, los controles y los checklists están en `seguridad.md`. Cada control indica si aplica en el desarrollo local o recién al desplegar.

**Aplican en el MVP0 (local):** SEC-04 (puertos solo en localhost), SEC-06 (máquina de desarrollo), SEC-10 (secretos), SEC-16 (CORS), SEC-17 (límites en la aplicación), SEC-20 a SEC-24 (cuentas, roles y acceso al pedido), SEC-30 a SEC-33 (precios, descuento y pagos), SEC-40 (abuso de stock), SEC-50 y SEC-51 (archivos), SEC-60 y SEC-61 (storefront), SEC-70 (datos personales), SEC-80 y SEC-81 (dependencias y plugins) y SEC-95 (registro de eventos).

**Se activan al desplegar:** SEC-01 a SEC-03 y SEC-05 (servidor y plataforma), SEC-11 (rotación), SEC-15 (HTTPS), SEC-52 (buckets), SEC-71 (retención), SEC-90 (respaldos) y SEC-96 (alertas).

## 25. Decisiones pendientes

| Tema | Estado | Se resuelve en |
|---|---|---|
| Plugin de Mercado Pago o proveedor propio | Abierto | SP-02 |
| Momento de creación del pedido con Mercado Pago | Recomendación: opción A | SP-02 |
| URLs de retorno en local y túnel temporal | Abierto | SP-02 |
| Roles nativos de Medusa o guard propio | **Cerrado:** guard propio | SP-01 |
| Condición fiscal y configuración de impuestos | Abierto | Dueño del comercio, antes de S1 |
| Plataforma de despliegue | Previsto Coolify, a reconfirmar | Etapa de despliegue |
| Almacenamiento externo | Abierto | Etapa de despliegue |
| Proveedor de email real | Abierto | Etapa de despliegue |
| Dominio | Abierto | Etapa de despliegue |

**Decisiones cerradas:** Medusa 2.22, PostgreSQL, Next.js 16.4.3 con el stack definido, transferencias sobre el proveedor manual de Medusa y desarrollo local primero, sin despliegue.

## 26. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión. |
| 2026-10-23 | 1.1 | Stack del storefront, R2, comprobantes privados y Coolify. |
| 2026-10-23 | 2 | Revisión completa: transferencias sobre el proveedor manual, estados derivados de Medusa, configuración en `store.metadata`, descuento con código interno y una sola fuente, configuración base de Medusa, storefront y punto de venta redefinidos, todo en Coolify, endpoints corregidos, variables completas y vínculo con `seguridad.md`. |
| 2026-10-23 | 3 | Alcance reducido a desarrollo local, sin despliegue en ninguna plataforma. Proveedores locales de archivos y notificaciones, comprobantes con driver local intercambiable, estrategia de pruebas de Mercado Pago sin URL pública, entorno local con Docker Compose, y la etapa de despliegue pasa a ser una sección de preparación. |
| 2026-10-23 | 3.1 | Resultado de SP-01: puntos **[Verificar]** resueltos con evidencia en `sp-01-medusa.md`. Se documenta que `GET /store/orders/:id` no tiene autenticación, que Medusa no valida archivos al subir y la configuración de `next/image` y de `backend_url` para imágenes locales. |
