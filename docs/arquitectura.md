# Arquitectura técnica: Tienda online + punto de venta (MVP0)

**Versión:** 2
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `producto.md`, `seguridad.md`, `planning.md`

> **Convenciones de este documento**
> - **[Medusa]**: viene de la plataforma, se usa sin modificaciones.
> - **[Propio]**: lo desarrollamos con las extensiones oficiales de Medusa.
> - **[Verificar]**: debe confirmarse contra la documentación y el código de la versión instalada antes de implementar. Todos los puntos marcados así forman parte del spike SP-01 de `planning.md`.

---

## 1. Principios

1. **Medusa primero.** Se usa lo que Medusa trae. Lo propio se agrega solo con extensiones oficiales (módulos, workflows, hooks, subscribers, rutas de API y extensiones del panel). Nunca se modifica el código de Medusa.
2. **Una instancia por cliente.** Mismo código, distinta configuración y datos. No hay multitenant.
3. **Una sola fuente de verdad por dato.** Ningún valor de negocio vive en dos lugares.
4. **El servidor decide.** Precios, totales, estados de pago y permisos se calculan y validan en el backend.
5. **Seguro por defecto.** Lo que no está permitido explícitamente está denegado. Ver `seguridad.md`.

## 2. Stack tecnológico

| Componente | Tecnología | Tipo |
|---|---|---|
| Backend, API y panel | Medusa.js 2.22 (TypeScript) | [Medusa] |
| Runtime | Node.js 22.22 o superior | Requisito de Medusa 2.22 |
| Base de datos | PostgreSQL | [Medusa] |
| Caché, eventos y colas | Redis | [Medusa] |
| Storefront | Next.js 16.4.3 (versión exacta, sin `^`) | [Propio] |
| Estilos y componentes del storefront | Tailwind CSS, shadcn/ui, Phosphor Icons | [Propio] |
| Estado del storefront | Zustand (solo estado de interfaz) y TanStack Query (solo interacciones del cliente) | [Propio] |
| Catálogo de componentes | Storybook (solo storefront) | [Propio] |
| Extensiones del panel | Medusa Admin SDK y Medusa UI | [Propio] sobre [Medusa] |
| Pago con tarjeta | Mercado Pago Checkout Pro | Plugin evaluado o proveedor propio (SP-02) |
| Pago por transferencia | Proveedor manual de Medusa (`pp_system_default`) | [Medusa] |
| Imágenes de producto | Cloudflare R2 con el proveedor `file-s3` | [Medusa] + configuración |
| Comprobantes | Cloudflare R2, bucket privado, con SDK de S3 | [Propio] |
| Emails | Proveedor de notificaciones compatible con Medusa | Pendiente de elegir |
| Despliegue | Coolify sobre una VPS, con Docker | Infraestructura |

## 3. Vista general

```
                     Internet
                        │
              ┌─────────▼──────────┐
              │ Proxy de Coolify   │  HTTPS, certificados, límites de solicitudes
              └──┬─────────────┬───┘
                 │             │
     ┌───────────▼───┐   ┌─────▼─────────────────────────┐
     │ Storefront    │   │ Medusa (modo servidor)        │
     │ Next.js       │──▶│  /store  API de tienda        │
     │               │   │  /admin  API de admin         │
     └───────────────┘   │  /app    Panel + punto de venta│
                         │  /hooks  Webhooks              │
                         └───┬──────────────┬─────────────┘
                             │              │
                   ┌─────────▼──┐   ┌───────▼──────────┐
                   │ PostgreSQL │   │ Redis            │◀── Medusa (modo worker)
                   └────────────┘   └──────────────────┘    jobs y suscriptores

  Red interna de Docker: PostgreSQL y Redis no publican puertos.

  Servicios externos:
  ─ Cloudflare R2: imágenes (público por dominio propio), comprobantes (privado), respaldos (privado)
  ─ Mercado Pago: Checkout Pro y webhooks
  ─ Proveedor de email

  Panel de Coolify: accesible solo por VPN o IP permitida (seguridad.md, SEC-02)
```

Medusa corre en dos procesos con la misma imagen: el **servidor**, que atiende solicitudes HTTP, y el **worker**, que ejecuta jobs programados y suscriptores de eventos. **[Verificar]** la variable y los valores exactos del modo de arranque en Medusa 2.22.

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
│   │   │   │   └── transfer-proof/   # Comprobantes de transferencia
│   │   │   ├── workflows/       # Flujos propios y hooks sobre flujos nativos
│   │   │   ├── subscribers/     # Emails y avisos
│   │   │   └── jobs/            # Vencimiento de pedidos, conciliación de pagos
│   │   ├── medusa-config.ts
│   │   ├── Dockerfile
│   │   └── .env.example
│   └── storefront/              # Next.js 16.4.3
│       ├── src/
│       ├── .storybook/
│       ├── Dockerfile
│       └── .env.example
├── packages/
│   └── shared-types/            # DTOs compartidos
├── docs/
│   ├── producto.md
│   ├── arquitectura.md
│   ├── seguridad.md
│   └── planning.md
├── docker-compose.yml           # Desarrollo local
└── README.md
```

## 5. Configuración base de Medusa

Esta configuración la realiza el superadmin una sola vez por instancia. Se documenta en un script o en una guía del README para que sea repetible.

| Elemento | Configuración | Tipo |
|---|---|---|
| Moneda | ARS como moneda por defecto de la tienda | [Medusa] |
| Región | "Argentina", país AR, moneda ARS | [Medusa] |
| Impuestos | Precios con impuestos incluidos. La alícuota depende de la condición fiscal del cliente (pendiente). | [Medusa] **[Verificar]** opción de precios con impuestos incluidos |
| Canales de venta | "Web" y "Local" | [Medusa] |
| Clave publicable | Una clave asociada al canal "Web", usada por el storefront | [Medusa] |
| Ubicación de stock | "Local", asociada a ambos canales | [Medusa] |
| Opciones de envío | "Retiro en el local" (sin costo) y "Envío a domicilio" (costo fijo) | [Medusa] |
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
- El **costo de envío** vive solo en la opción de envío de Medusa.

**[Verificar]** que la `metadata` de `Store` no se exponga en la API de tienda. Si se expone, `transfer_promotion_code` debe moverse a una variable de entorno.

## 7. Modelo de datos

### 7.1 Entidades nativas usadas [Medusa]

| Entidad | Uso |
|---|---|
| `Product`, `ProductOption`, `ProductOptionValue`, `ProductVariant` | Catálogo, talles, colores y variantes. Las opciones se definen por producto. |
| `ProductCategory` | Jerarquía de tres niveles. Desactivación con el campo nativo de categoría activa. **[Verificar]** nombre del campo. |
| `Price` | Precio de lista por variante. |
| `InventoryItem`, `InventoryLevel`, `ReservationItem` | Stock y reservas. |
| `SalesChannel` | "Web" y "Local". |
| `Promotion` | Descuento por transferencia y promociones del admin. |
| `Cart`, `LineItem`, `Order` | Carrito y pedidos. |
| `PaymentCollection`, `PaymentSession`, `Payment` | Pagos, capturas y reembolsos. |
| `User` | Usuarios del panel. |
| `Store` | Configuración del comercio en `metadata`. |

### 7.2 Datos propios

**Muestra de color.** Se guarda en la `metadata` del valor de opción de color: `{ "hex": "#RRGGBB" }`. **[Verificar]** que `ProductOptionValue` admita `metadata` editable. Si no la admite, se crea un módulo con un vínculo a `ProductOptionValue`.

**Acceso del cliente al pedido.** Se guarda en la `metadata` del pedido:

| Clave | Descripción |
|---|---|
| `access_token_hash` | Hash SHA-256 del token. El token nunca se guarda. |
| `access_token_expires_at` | Vencimiento del token. Se fija cuando el pedido se cierra. |

**[Verificar]** que la `metadata` del pedido no se devuelva en respuestas públicas. Aunque solo contiene un hash, conviene no exponerla.

**Comprobante de transferencia.** Módulo propio `transfer-proof`, vinculado a `Order`.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador. |
| `order_id` | string | sí | Pedido. Un pedido puede tener varios comprobantes (uno por intento). |
| `storage_key` | string | sí | Clave en el bucket privado. |
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

**[Verificar]** los nombres exactos de los estados de pedido y de pago en Medusa 2.22, y en qué estado queda el pago con el proveedor manual al completar el carrito.

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

- **[Verificar]** que al aplicar o quitar la promoción se recalcule el total de la colección de pago, o reiniciar la sesión de pago de forma explícita.
- **[Verificar]** que el hook del flujo de completar carrito permita leer la sesión de pago elegida.

## 10. Pago con tarjeta (Mercado Pago)

### 10.1 Flujo

1. El storefront inicia la sesión de pago con el proveedor de Mercado Pago. El backend crea la preferencia de Checkout Pro con el total calculado por Medusa y una referencia externa propia del carrito.
2. El cliente paga en Mercado Pago y vuelve a la tienda.
3. Mercado Pago envía una notificación al webhook del backend.
4. El backend valida la firma, consulta el pago a la API de Mercado Pago, verifica monto, moneda y referencia, y actualiza el pago (`seguridad.md`, SEC-32).
5. La página de regreso muestra el estado que consulta el backend.

### 10.2 Decisión pendiente: cuándo se crea el pedido

| Opción | Ventaja | Riesgo |
|---|---|---|
| **A.** El carrito se completa al llegar el pago aprobado | No quedan pedidos sin pagar | El stock no está reservado mientras el cliente paga. Hay que verificar stock al completar y reembolsar si ya no hay. |
| **B.** El carrito se completa antes de redirigir, con el pago pendiente | El stock queda reservado | Quedan pedidos sin pagar si el cliente abandona. Necesitan vencimiento. |

La decisión se toma en SP-02 según cómo funcione el plugin elegido o el contrato de proveedores de Medusa. Recomendación inicial: **opción A**, porque es el comportamiento habitual de los proveedores de pago de Medusa y evita pedidos fantasma. La verificación de stock al completar y el reembolso automático forman parte de la historia.

### 10.3 Conciliación

Un job del worker revisa periódicamente los pagos iniciados sin resolución, consultando la API de Mercado Pago. Cubre los casos en que el webhook no llega.

## 11. Pago por transferencia

1. El cliente elige transferencia. Se aplica la promoción (sección 9) y se inicia la sesión con el proveedor manual.
2. El carrito se completa y se crea el pedido con el pago pendiente. El stock queda reservado por las reservas nativas de Medusa.
3. Se genera el token de acceso al pedido y se envía el email con los datos bancarios.
4. El cliente sube el comprobante (`POST /store/order-access/:id/transfer-proofs`).
5. El admin revisa el comprobante en una extensión del panel:
   - **Aceptar:** el comprobante pasa a `accepted` y se captura el pago con el flujo nativo de Medusa.
   - **Rechazar:** el comprobante pasa a `rejected` con motivo. El pedido sigue pendiente.
6. Un job del worker cancela los pedidos por transferencia sin comprobante aceptado después de `transfer_reservation_hours`, usando la cancelación nativa. **[Verificar]** que la cancelación nativa libere las reservas de stock.

Un pedido con un comprobante en revisión no se cancela por vencimiento hasta que el admin lo revise.

## 12. Punto de venta

- Es una **ruta propia dentro del panel de Medusa**, construida con Medusa Admin SDK y Medusa UI. No usa shadcn ni el storefront.
- Cada venta se crea en el canal "Local", con el proveedor manual y el pago capturado en el mismo paso.
- **[Verificar]** si los pedidos borrador (`draft orders`) de Medusa sirven como base. Si no, la ruta propia ejecuta los workflows nativos de creación de pedido.
- El reporte de ventas del día filtra pedidos por canal "Local" y fecha.

## 13. Endpoints

### 13.1 Convenciones

- **Tienda:** header `x-publishable-api-key` con la clave del canal "Web".
- **Admin:** sesión o token de usuario autenticado.
- **Cliente invitado:** token de acceso al pedido en el header `x-order-token`.
- Formato JSON, fechas ISO 8601 en UTC.
- **[Verificar]** si Medusa 2.22 expresa los montos en unidades de la moneda o en centavos.

### 13.2 Endpoints nativos usados [Medusa]

Los nombres siguen la API de Medusa 2.x. **Todos se verifican en SP-01** contra la versión instalada.

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
| GET | `/store/order-access/:id` | Token del pedido | Detalle del pedido para el cliente invitado. |
| POST | `/store/order-access/:id/transfer-proofs` | Token del pedido | Subir comprobante. |
| GET | `/store/order-access/:id/transfer-proofs` | Token del pedido | Estado del último comprobante y motivo de rechazo. |
| POST | `/hooks/mercadopago` | Firma de Mercado Pago | Webhook (solo si se desarrolla el proveedor propio; con plugin, la ruta la define el plugin). |

**Admin**

| Método | Ruta | Rol | Uso |
|---|---|---|---|
| GET | `/admin/transfer-proofs` | admin, vendedor (lectura) | Cola de comprobantes, filtrable por estado. |
| GET | `/admin/transfer-proofs/:id/url` | admin, vendedor (lectura) | Enlace firmado de 15 minutos. |
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
| `STOCK_INSUFFICIENT` | 409 | No hay stock suficiente. | Reducir la cantidad o elegir otra variante. |
| `MAX_UNITS_EXCEEDED` | 422 | Supera el máximo de unidades por variante. | Reducir la cantidad o comprar en el local. |
| `VARIANT_UNAVAILABLE` | 409 | Variante despublicada o sin precio. | Elegir otra combinación. |
| `DISCOUNT_PAYMENT_MISMATCH` | 422 | Descuento de transferencia con otro medio de pago. | Volver a elegir el medio de pago. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | Mercado Pago no responde. | Reintentar o pagar por transferencia. |
| `PAYMENT_AMOUNT_MISMATCH` | 409 | El monto pagado no coincide con el pedido. | Interno: se registra y el admin revisa. |
| `ORDER_ALREADY_PAID` | 409 | El pedido ya está pagado. | Ver el estado del pedido. |
| `ORDER_EXPIRED` | 409 | El pedido venció antes de aceptar un comprobante. | Hacer un pedido nuevo. |
| `ORDER_ACCESS_DENIED` | 404 | Token inválido o vencido. | Usar el enlace del email. No revela si el pedido existe. |
| `PENDING_ORDERS_LIMIT` | 429 | Superó el límite de pedidos pendientes. | Completar o esperar el vencimiento de un pedido anterior. |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes. | Esperar y reintentar. |
| `TRANSFER_PROOF_TOO_LARGE` | 413 | Archivo mayor a 5 MB. | Comprimir o subir PDF. |
| `TRANSFER_PROOF_FORMAT_INVALID` | 415 | Formato no permitido. | Subir JPG, PNG o PDF. |
| `TRANSFER_PROOF_PENDING` | 409 | Ya hay un comprobante en revisión. | Esperar la revisión. |
| `TRANSFER_PROOF_NOT_REVIEWABLE` | 409 | El comprobante ya fue revisado. | Revisar el estado actual. |
| `REJECTION_REASON_REQUIRED` | 422 | Motivo de rechazo inválido. | Escribir un motivo de 10 a 300 caracteres. |
| `SALE_ITEMS_EMPTY` | 422 | Venta sin productos. | Agregar al menos un producto. |
| `SETTING_INVALID` | 422 | Valor de configuración inválido. | Corregir el campo indicado. |
| `ROLE_NOT_ALLOWED` | 403 | El rol no tiene permiso para la acción. | Pedir el permiso al admin. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Firma de Mercado Pago inválida. | No aplica al usuario. Se registra y se descarta. |

## 16. Autenticación y autorización

### 16.1 Tipos de acceso

| Quién | Mecanismo | Detalle |
|---|---|---|
| Superadmin, admin y vendedor | Usuario y contraseña de Medusa | Sesión del panel. **[Verificar]** si 2.22 usa cookie de sesión, JWT o ambos, y su vencimiento. |
| Storefront | Clave publicable del canal "Web" | Identifica la tienda. Es pública y no da acceso a datos privados. |
| Cliente comprando | Sin cuenta | El identificador del carrito vive en una cookie `HttpOnly` del storefront. |
| Cliente consultando su pedido | Token de acceso al pedido | Ver `seguridad.md`, SEC-24. |

### 16.2 Roles

- **Opción preferida:** usar los roles y políticas nativos de Medusa. Las notas de versión recientes muestran trabajo en roles, políticas y superadmin dentro de Medusa. **[Verificar]** si está disponible en la versión de código abierto 2.22, si requiere un flag y cómo se configura.
- **Alternativa:** guard propio sobre `/admin/*` con lista de rutas permitidas para el vendedor y **denegación por defecto**.
- En ambos casos, cada ruta del admin tiene una prueba automatizada por rol.
- **Limitación conocida:** el menú del panel puede mostrar secciones que el usuario no puede usar. Se documenta para el dueño y se evalúa ocultarlas con extensiones del panel.

## 17. Almacenamiento

### 17.1 Base de datos

PostgreSQL es la única fuente de verdad. Migraciones con las herramientas de Medusa, ejecutadas antes de cada despliegue.

### 17.2 Imágenes de producto [Medusa]

- Proveedor oficial `file-s3` apuntando a Cloudflare R2.
- Servidas desde un dominio propio (`imagenes.<dominio>`). Las URLs guardadas usan ese dominio, así una migración futura a MinIO no requiere reescribir datos.
- El storefront las optimiza con `next/image`, con el dominio declarado en la configuración.

### 17.3 Comprobantes [Propio]

- Bucket privado separado. El módulo de archivos de Medusa acepta un solo proveedor, por eso los comprobantes usan el SDK de S3 desde el módulo `transfer-proof`.
- Detalle de controles en `seguridad.md`, SEC-51.

### 17.4 Respaldos

Bucket privado exclusivo, con credenciales propias. Ver `seguridad.md`, SEC-90.

### 17.5 Variables de entorno

**Backend**

```
NODE_ENV=
MEDUSA_WORKER_MODE=            # server | worker  [Verificar nombre exacto]
DISABLE_MEDUSA_ADMIN=          # false en servidor, true en worker  [Verificar]
MEDUSA_BACKEND_URL=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
COOKIE_SECRET=
STORE_CORS=
ADMIN_CORS=
AUTH_CORS=

# Imágenes (público)
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FILE_URL=https://imagenes.<dominio>

# Comprobantes (privado)
PROOFS_S3_BUCKET=
PROOFS_S3_ACCESS_KEY_ID=
PROOFS_S3_SECRET_ACCESS_KEY=

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Email
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=
```

**Storefront**

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=
NEXT_PUBLIC_IMAGES_DOMAIN=imagenes.<dominio>
```

**Respaldos** (servicio o job de respaldo): credenciales propias del bucket de respaldos y clave de cifrado.

## 18. Storefront

- Se construye **desde cero** con Next.js 16.4.3 y el SDK de JavaScript de Medusa, usando el starter oficial solo como referencia. El starter tiene su propio stack, que no coincide con el elegido.
- **Server Components** para catálogo, categorías y detalle de producto.
- **Server Actions** para modificar el carrito y elegir el medio de pago.
- El **carrito vive en Medusa**. El storefront solo guarda su identificador en una cookie `HttpOnly`.
- **TanStack Query** solo para datos que se consultan desde el navegador después de cargar la página, como el estado del comprobante en la página del pedido.
- **Zustand** solo para estado de interfaz: apertura del carrito lateral, filtros en edición y preferencias visuales. Nunca para precios, stock ni contenido del carrito.
- **Storybook** documenta los componentes del storefront.
- Se despliega como contenedor en Coolify, en modo `standalone`.

## 19. Notificaciones

| Evento | Destinatario | Contenido |
|---|---|---|
| Pedido por transferencia creado | Cliente | Datos bancarios, monto, referencia, vencimiento y enlace al pedido. |
| Pedido pagado | Cliente | Confirmación, ítems, total y enlace al pedido. |
| Comprobante recibido | Admin | Enlace a la cola de revisión. |
| Comprobante rechazado | Cliente | Motivo y enlace para subir otro. |
| Pedido cancelado | Cliente | Motivo (vencimiento o cancelación del comercio). |

Los emails se envían desde suscriptores del worker, con reintentos. El proveedor está pendiente de elección (TEC-02 de `planning.md`).

## 20. Despliegue en Coolify

| Servicio | Imagen | Expuesto | Notas |
|---|---|---|---|
| `storefront` | Dockerfile del storefront | Sí, por el proxy | Next.js en modo `standalone`. |
| `medusa-server` | Dockerfile del backend | Sí, por el proxy | API, panel y webhooks. |
| `medusa-worker` | Misma imagen del backend | No | Jobs y suscriptores. |
| `postgres` | Base de datos de Coolify | No | Sin puertos publicados. |
| `redis` | Base de datos de Coolify | No | Sin puertos publicados. |

**Entornos**

| Entorno | Propósito | Mercado Pago |
|---|---|---|
| Desarrollo | Local con `docker compose` | Credenciales de prueba |
| Staging | Proyecto separado en Coolify | Credenciales de prueba |
| Producción | Proyecto separado en Coolify | Credenciales de producción |

**Proceso de despliegue**
1. CI construye y prueba en cada pull request.
2. Al integrar en la rama principal, Coolify despliega en staging.
3. Producción se despliega de forma manual, desde una versión etiquetada.
4. Las migraciones corren antes de levantar la nueva versión.
5. Cada despliegue conserva la imagen anterior para volver atrás.

**Recursos:** para empezar, una VPS de 4 GB de RAM es un mínimo razonable y 8 GB da margen para storefront, backend, worker y bases en el mismo servidor. Son cifras orientativas, a validar con mediciones en staging.

## 21. Observabilidad

- Logs estructurados en JSON, con identificador de solicitud y de pedido, sin datos personales.
- Métricas: pedidos por hora, pagos aprobados y rechazados, comprobantes pendientes, errores 5xx.
- Monitoreo externo de disponibilidad del storefront y del backend.
- Alertas definidas en `seguridad.md`, SEC-96.

## 22. Pruebas

| Tipo | Alcance | Herramienta |
|---|---|---|
| Unitarias | Validaciones, derivación de estados, cálculo de límites | Vitest o Jest |
| Integración | Rutas propias, hook de descuento, webhook, permisos por rol | Pruebas de integración de Medusa |
| Extremo a extremo | Compra con tarjeta (sandbox), compra por transferencia, venta en el local, vencimiento, rechazo | Playwright |
| Concurrencia | Compras simultáneas de la última unidad | k6 |

Criterios mínimos antes de producción: ningún stock negativo, ningún descuento de transferencia cobrado con tarjeta, ningún webhook procesado dos veces y todos los controles del checklist de `seguridad.md`.

## 23. Seguridad

El modelo de amenazas, los controles y el checklist de lanzamiento están en `seguridad.md`. Resumen de los controles que más condicionan esta arquitectura:

- Panel de Coolify no expuesto a internet y actualizado (SEC-02, SEC-03).
- Bases de datos sin puertos publicados (SEC-04).
- Firma del webhook y verificación del monto con la API de Mercado Pago (SEC-32).
- Token de acceso al pedido reutilizable, guardado como hash (SEC-24).
- Denegación por defecto para el rol vendedor (SEC-21).
- Límites contra pedidos falsos (SEC-40).

## 24. Decisiones pendientes

| Tema | Estado | Se resuelve en |
|---|---|---|
| Plugin de Mercado Pago o proveedor propio | Abierto | SP-02 |
| Momento de creación del pedido con Mercado Pago | Recomendación: opción A | SP-02 |
| Roles nativos de Medusa o guard propio | Abierto | SP-01 |
| Proveedor de email | Abierto | TEC-02 |
| Condición fiscal y configuración de impuestos | Abierto | Dueño del comercio |
| Dominio | Abierto | Dueño del comercio |
| Migración futura a MinIO | Planificada si hace falta | Fuera del MVP0 |

Decisiones cerradas: Medusa 2.22, PostgreSQL, Coolify para todos los servicios, Cloudflare R2 con dominio propio, Next.js 16.4.3 con el stack definido, transferencias sobre el proveedor manual de Medusa.

## 25. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión. |
| 2026-10-23 | 1.1 | Stack del storefront, R2, comprobantes privados y Coolify. |
| 2026-10-23 | 2 | Revisión completa: transferencias sobre el proveedor manual, estados derivados de Medusa, configuración en `store.metadata`, descuento con código interno y una sola fuente, configuración base de Medusa, storefront y punto de venta redefinidos, todo en Coolify, endpoints corregidos, variables completas y vínculo con `seguridad.md`. |
