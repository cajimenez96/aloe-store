# Arquitectura técnica: Tienda online + punto de venta (MVP0)

**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `producto.md`

> **Convención de este documento.** Cada endpoint, modelo y componente está marcado como **[Medusa]** si viene de la plataforma sin modificaciones, o **[Propio]** si lo desarrollamos. Los nombres de endpoints nativos corresponden a la API de Medusa 2.x y deben verificarse contra la versión instalada antes de implementar.

---

## 1. Principios

1. **Medusa como núcleo.** Se usa lo que la plataforma ofrece. Cualquier desarrollo propio se hace con sus extensiones oficiales (módulos, workflows, subscribers, hooks y proveedores), nunca modificando el código de Medusa.
2. **Una instancia por cliente.** Mismo código base, distinta configuración y datos. No hay multitenant.
3. **Mínimo desarrollo propio.** Se construye solo lo que el negocio no puede resolver con la plataforma.
4. **Datos sensibles fuera del alcance público.** Comprobantes, credenciales y datos de clientes nunca se exponen sin autenticación.
5. **Escrituras transaccionales.** Stock, pedidos y pagos se modifican dentro de transacciones para evitar sobreventa e inconsistencias.

## 2. Stack tecnológico

| Componente | Tecnología | Decisión |
|---|---|---|
| Backend y admin | Medusa.js 2.22 (TypeScript) | [Medusa] |
| Runtime | Node.js 22.22 o superior | Requisito de Medusa 2.22 |
| Base de datos | PostgreSQL 16 o superior | Requisito de Medusa |
| Caché y eventos | Redis | Recomendado para producción |
| Storefront | Next.js 16.4.3 (versión exacta fijada, sin `^`), a partir del starter oficial de Medusa | [Medusa] + ajustes visuales |
| Estilos | Tailwind CSS | Base de estilos del storefront |
| Componentes | shadcn/ui | Componentes copiados al repositorio, no como dependencia cerrada |
| Íconos | Phosphor Icons | Un solo set de íconos en toda la aplicación |
| Estado del cliente | Zustand | Carrito local, preferencias de interfaz y estado de la sesión de compra |
| Datos del servidor | TanStack Query (React Query) | Caché y sincronización de catálogo, carrito y pedidos |
| Documentación de componentes | Storybook | Desarrollo y revisión aislada de componentes de la tienda y del admin |
| Guía visual | `DESIGN.md` de Shopify (tokens y patrones, sin copiar la identidad de marca) | Referencia de diseño |
| Pagos con tarjeta | Mercado Pago Checkout Pro | Integración con plugin de la comunidad o proveedor propio (ver sección 9) |
| Pagos por transferencia | Proveedor de pago propio, de tipo manual | [Propio] |
| Almacenamiento de imágenes | Cloudflare R2 (API compatible con S3), con el proveedor oficial `file-s3` de Medusa | [Medusa] + configuración. Migración futura a MinIO sin cambiar URLs (ver sección 11) |
| Almacenamiento privado (comprobantes) | Cloudflare R2, con SDK de S3 directo desde un módulo propio | [Propio] |
| Autenticación de admin | Usuarios de Medusa con JWT | [Medusa] |
| Notificaciones por email | Proveedor de Medusa | Pendiente de elegir (ver sección 13) |
| Contenedores | Docker y Docker Compose | Para desarrollo y despliegue |

## 3. Vista general

```
┌────────────────────┐       ┌──────────────────────────────────────┐
│  Storefront        │       │  Backend Medusa 2.22                 │
│  (Next.js)         │──API──│                                      │
│  - Catálogo        │ store │  Store API  ──► Carrito, pedidos,    │
│  - Carrito/checkout│       │                 pagos, promociones   │
└────────────────────┘       │                                      │
                             │  Admin API  ──► Productos, stock,    │
┌────────────────────┐       │                 pedidos, promociones │
│  Admin (dashboard) │──API──│                                      │
│  - Gestión         │ admin │  Propio: proveedor de transferencia, │
│  - Punto de venta  │       │  validación de descuento, comprobantes│
└────────────────────┘       └───┬───────────────┬──────────────┬───┘
                                 │               │              │
                          ┌──────▼─────┐  ┌──────▼──────┐ ┌─────▼──────────┐
                          │ PostgreSQL │  │    Redis    │ │ Storage S3     │
                          └────────────┘  └─────────────┘ │ (imágenes y    │
                                                          │  comprobantes) │
                          ┌─────────────────────────┐     └────────────────┘
                          │ Mercado Pago (webhooks) │
                          └─────────────────────────┘
```

## 4. Estructura del repositorio

```
ecommerce-mvp0/
├── apps/
│   ├── backend/              # Medusa 2.22 (API, admin y extensiones propias)
│   │   ├── src/
│   │   │   ├── admin/        # Personalizaciones del dashboard (si hacen falta)
│   │   │   ├── api/          # Endpoints propios (store y admin)
│   │   │   ├── modules/      # Módulos propios (transferencias, comprobantes)
│   │   │   ├── workflows/    # Flujos propios (pedido por transferencia, venta local)
│   │   │   ├── subscribers/  # Respuestas a eventos (emails, notificaciones)
│   │   │   └── providers/    # Proveedor de pago por transferencia
│   │   ├── medusa-config.ts
│   │   └── .env.example
│   └── storefront/           # Next.js
├── packages/
│   └── shared-types/         # DTOs compartidos entre backend y storefront
├── docs/
│   ├── producto.md
│   └── arquitectura.md
├── docker-compose.yml
└── README.md
```

## 5. Configuración del sistema

La configuración de la tienda se guarda en la base de datos y la edita el admin desde el panel. Las credenciales se guardan en variables de entorno, nunca en la base de datos.

### 5.1 Configuración editable por el admin [Propio]

| Clave | Tipo | Valor por defecto | Descripción |
|---|---|---|---|
| `transfer_discount_percent` | number (0 a 100) | 0 | Porcentaje de descuento por transferencia. |
| `transfer_rounding` | enum | `nearest_integer` | Redondeo del precio por transferencia. |
| `reservation_ttl_hours` | number | 48 | Horas que se reserva el stock de un pedido pendiente de transferencia. |
| `transfer_proof_max_mb` | number | 5 | Tamaño máximo del comprobante. |
| `transfer_proof_formats` | string[] | `["jpg","png","pdf"]` | Formatos aceptados. |
| `bank_account` | objeto | — | Titular, CBU/CVU, alias y banco. Se muestran al cliente. |
| `shipping_flat_rate` | number | 0 | Costo fijo de envío a domicilio. |
| `notify_admin_email` | string | — | Destinatario de avisos de comprobantes pendientes. |

Los valores se exponen mediante un endpoint de lectura para la tienda (sin datos sensibles) y uno de escritura para el admin.

### 5.2 Variables de entorno

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
COOKIE_SECRET=
STORE_CORS=
ADMIN_CORS=
AUTH_CORS=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
EMAIL_PROVIDER_API_KEY=
PUBLIC_BACKEND_URL=
```

## 6. Modelo de datos

### 6.1 Entidades nativas [Medusa]

| Entidad | Uso en el proyecto |
|---|---|
| `Product` | Producto publicado, con título, descripción, estado e imágenes. |
| `ProductOption` | Opción del producto (por ejemplo, "Talle" o "Color"). |
| `ProductOptionValue` | Valor de la opción (por ejemplo, "M" o "Negro"). |
| `ProductVariant` | Combinación de valores de opción. Es la unidad vendible. |
| `ProductCategory` | Categoría, con jerarquía padre-hijo sin límite de niveles. Se usa en tres niveles. |
| `Price` | Precio de lista de la variante. |
| `InventoryItem` y `InventoryLevel` | Stock por variante y ubicación. |
| `Promotion` y `ApplicationMethod` | Descuentos por porcentaje, con o sin código. |
| `Cart` y `LineItem` | Carrito y líneas. |
| `Order` | Pedido. |
| `PaymentCollection` y `PaymentSession` | Pagos asociados al pedido. |
| `User` | Usuarios del admin. |

### 6.2 Entidades propias [Propio]

#### `ProductColor`
Muestra visual para valores de opción de color.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador. |
| `option_value_id` | string | sí | Referencia a `ProductOptionValue`. Único. |
| `hex` | string | sí | Color en formato `#RRGGBB`. |
| `created_at` | datetime | sí | |
| `updated_at` | datetime | sí | |

#### `TransferPayment`
Datos de un pago por transferencia asociado a un pedido.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador. |
| `order_id` | string | sí | Pedido. Único. |
| `status` | enum | sí | `pending`, `proof_received`, `confirmed`, `rejected`, `expired`. |
| `amount` | number | sí | Monto a transferir, ya con descuento aplicado. |
| `reference` | string | sí | Referencia que el cliente debe usar (número de pedido). |
| `reserved_until` | datetime | sí | Vencimiento de la reserva de stock. |
| `reviewed_by` | string | no | Usuario admin que revisó. |
| `reviewed_at` | datetime | no | |
| `rejection_reason` | string | no | Motivo visible para el cliente. |
| `created_at` | datetime | sí | |
| `updated_at` | datetime | sí | |

#### `TransferProof`
Comprobante subido por el cliente.

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | string | sí | Identificador. |
| `transfer_payment_id` | string | sí | Referencia a `TransferPayment`. |
| `storage_key` | string | sí | Clave del archivo en el storage privado. No es una URL pública. |
| `mime_type` | string | sí | `image/jpeg`, `image/png` o `application/pdf`. |
| `size_bytes` | number | sí | Tamaño del archivo. |
| `uploaded_at` | datetime | sí | |

#### `StoreSetting`
Configuración del sistema (sección 5.1).

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `key` | string | sí | Clave única. |
| `value` | json | sí | Valor tipado según la clave. |
| `updated_by` | string | no | Usuario que modificó. |
| `updated_at` | datetime | sí | |

### 6.3 Reglas del modelo

- Una categoría puede tener hijos hasta tres niveles por convención de la interfaz. Medusa no impone el límite.
- Un producto puede pertenecer a varias categorías en Medusa. La interfaz restringe a una sola subcategoría por producto.
- Desactivar en lugar de eliminar: categorías, opciones y valores de opción que tienen uso se marcan como inactivos. Los pedidos históricos conservan la referencia.
- Las entidades `TransferPayment` y `TransferProof` se crean solo para pedidos con medio de pago por transferencia.

## 7. Descuento por transferencia

### 7.1 Mecanismo

1. El admin crea una **promoción automática** de tipo porcentaje sobre el pedido, asociada al medio de pago de transferencia. El valor del porcentaje se toma de `transfer_discount_percent`.
2. Cuando el cliente elige transferencia, el storefront recalcula el carrito con esa promoción.
3. Cuando elige tarjeta, la promoción se quita del carrito antes de iniciar la sesión de Mercado Pago.
4. Al completar el pedido, un **hook de validación** del flujo de completar carrito verifica que la promoción de transferencia solo esté presente si el proveedor de pago elegido es el de transferencia. Si no coincide, se rechaza la operación con el error `DISCOUNT_PAYMENT_MISMATCH`.

### 7.2 Redondeo

El precio por transferencia se calcula como:

```
precio_transferencia = redondear(precio_lista × (1 − porcentaje / 100))
```

El redondeo se aplica al entero más cercano. El cálculo se hace en el backend, en el momento del pedido, y el storefront solo lo muestra.

### 7.3 Pendiente de verificación

- Confirmar en la versión instalada que las promociones de tipo porcentaje sobre el pedido se pueden crear como automáticas y aplicar sobre el total del carrito.
- Confirmar que al cambiar el medio de pago se recalculan las sesiones de pago. Si no ocurre, el paso 3 debe incluir la reinicialización de la sesión.

## 8. Endpoints

### 8.1 Convenciones

- **Prefijos:** `/store/` para la tienda, `/admin/` para el panel. Los endpoints propios siguen el mismo prefijo.
- **Autenticación:**
  - Tienda: clave publicable de Medusa en el header `x-publishable-api-key`. Los clientes son invitados, sin sesión obligatoria.
  - Admin: JWT en el header `Authorization: Bearer <token>`.
- **Formato:** JSON. Fechas en ISO 8601 en UTC.
- **Montos:** número en la unidad de la moneda (ARS), con dos decimales cuando aplique. Verificar la convención de Medusa 2.22.
- **Paginación:** `limit` y `offset` como query params. Respuesta con `count`, `offset` y `limit`.
- **Errores:** ver sección 10.

### 8.2 Endpoints nativos [Medusa]

Se listan los que el proyecto usa. Los nombres siguen la API de Medusa 2.x y se verifican contra la versión instalada.

**Tienda**

| Método | Ruta | Uso |
|---|---|---|
| GET | `/store/products` | Listado con filtros por categoría y búsqueda. |
| GET | `/store/products/:id` | Detalle de producto con opciones y variantes. |
| GET | `/store/product-categories` | Árbol de categorías. |
| POST | `/store/carts` | Crear carrito. |
| GET | `/store/carts/:id` | Obtener carrito. |
| POST | `/store/carts/:id/line-items` | Agregar variante al carrito. |
| POST | `/store/carts/:id/promotions` | Aplicar promoción (por código o automática). |
| DELETE | `/store/carts/:id/promotions/:code` | Quitar promoción. |
| POST | `/store/carts/:id/shipping-methods` | Elegir envío o retiro. |
| POST | `/store/payment-collections` | Crear colección de pago. |
| POST | `/store/payment-collections/:id/payment-sessions` | Iniciar sesión de pago con el proveedor elegido. |
| POST | `/store/carts/:id/complete` | Completar el carrito y crear el pedido. |
| GET | `/store/orders/:id` | Detalle del pedido, con token de acceso. |

**Admin**

| Método | Ruta | Uso |
|---|---|---|
| GET / POST | `/admin/products` | Listar y crear productos. |
| GET / POST / PATCH | `/admin/product-categories` | Gestionar categorías. |
| GET / POST / PATCH | `/admin/product-options` | Gestionar opciones (talle, color). |
| GET / POST | `/admin/promotions` | Gestionar promociones. |
| GET / POST | `/admin/orders` | Listar y consultar pedidos. |
| POST | `/admin/draft-orders` | Crear pedido manual, base para la venta en el local. |
| GET / POST | `/admin/inventory-items` | Consultar y ajustar stock. |

### 8.3 Endpoints propios [Propio]

**Tienda**

| Método | Ruta | Autenticación | Uso |
|---|---|---|---|
| GET | `/store/settings/public` | Clave publicable | Devuelve `transfer_discount_percent`, `bank_account`, `shipping_flat_rate` y `transfer_proof_formats`. |
| POST | `/store/orders/:id/transfer-proof` | Token del pedido | Sube el comprobante de transferencia. |
| GET | `/store/orders/:id/transfer-status` | Token del pedido | Estado de la transferencia y motivo de rechazo, si lo hay. |

**Admin**

| Método | Ruta | Rol | Uso |
|---|---|---|---|
| GET | `/admin/transfers` | admin, vendedor | Lista de transferencias, filtrable por estado. |
| GET | `/admin/transfers/:id/proof` | admin | Devuelve un enlace firmado y temporal al comprobante. |
| POST | `/admin/transfers/:id/confirm` | admin | Confirma la transferencia y marca el pedido como pagado. |
| POST | `/admin/transfers/:id/reject` | admin | Rechaza el comprobante, con motivo obligatorio. |
| GET / PATCH | `/admin/settings` | admin | Lee y actualiza la configuración del sistema. |
| POST | `/admin/product-colors` | admin | Crea o actualiza la muestra de color de una opción. |
| POST | `/admin/pos/sales` | admin, vendedor | Registra una venta en el local. |
| POST | `/admin/products/:id/stock-adjustments` | admin | Ajusta stock con motivo obligatorio. |

## 9. Payloads y DTOs

### 9.1 Pago por transferencia (proveedor propio)

Los DTOs se definen en `packages/shared-types` y se validan en el backend con Zod o el validador que incluya Medusa.

**Iniciar sesión de pago por transferencia** (`POST /store/payment-collections/:id/payment-sessions`)

```json
{
  "provider_id": "pp_transfer_manual"
}
```

**Respuesta**

```json
{
  "payment_collection": {
    "id": "paycol_01",
    "amount": 9000,
    "payment_sessions": [
      {
        "id": "payses_01",
        "provider_id": "pp_transfer_manual",
        "status": "pending",
        "data": {
          "reference": "ORD-2026-000123",
          "reserved_until": "2026-10-25T18:00:00Z"
        }
      }
    ]
  }
}
```

**Subir comprobante** (`POST /store/orders/:id/transfer-proof`, `multipart/form-data`)

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `file` | archivo | sí | JPG, PNG o PDF. Máximo `transfer_proof_max_mb`. |
| `token` | string | sí | Token de acceso al pedido, en el header `x-order-token`. |

**Respuesta**

```json
{
  "transfer": {
    "id": "trf_01",
    "order_id": "order_01",
    "status": "proof_received",
    "uploaded_at": "2026-10-23T15:30:00Z"
  }
}
```

**Confirmar transferencia** (`POST /admin/transfers/:id/confirm`)

```json
{
  "note": "Acreditado en cuenta el 23/10"
}
```

**Rechazar transferencia** (`POST /admin/transfers/:id/reject`)

```json
{
  "reason": "El monto del comprobante no coincide con el total del pedido."
}
```

El motivo es obligatorio, tiene entre 10 y 300 caracteres, y es visible para el cliente.

### 9.2 Venta en el local

**Registrar venta** (`POST /admin/pos/sales`)

```json
{
  "items": [
    { "variant_id": "variant_01", "quantity": 2 },
    { "variant_id": "variant_02", "quantity": 1 }
  ],
  "payment_method": "cash",
  "customer": {
    "name": "Ana Pérez",
    "document": null
  },
  "note": null
}
```

| Campo | Tipo | Requerido | Valores |
|---|---|---|---|
| `items` | array | sí | Al menos un elemento. |
| `items[].variant_id` | string | sí | Variante existente y activa. |
| `items[].quantity` | integer | sí | Mayor que 0. |
| `payment_method` | enum | sí | `cash`, `transfer`, `card`. |
| `customer` | objeto | no | Nombre opcional. Documento opcional. |
| `note` | string | no | Hasta 300 caracteres. |

**Respuesta**

```json
{
  "sale": {
    "id": "order_pos_01",
    "total": 18500,
    "payment_method": "cash",
    "items": [
      { "variant_id": "variant_01", "quantity": 2, "unit_price": 6500 },
      { "variant_id": "variant_02", "quantity": 1, "unit_price": 5500 }
    ],
    "created_at": "2026-10-23T16:02:11Z"
  }
}
```

### 9.3 Ajuste de stock

**Ajustar stock** (`POST /admin/products/:id/stock-adjustments`)

```json
{
  "variant_id": "variant_01",
  "quantity_change": -1,
  "reason": "Producto dañado en depósito"
}
```

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `variant_id` | string | sí | Variante del producto. |
| `quantity_change` | integer | sí | Distinto de 0. Puede ser negativo. |
| `reason` | string | sí | Entre 5 y 200 caracteres. |

El stock resultante no puede ser negativo. Si el ajuste lo dejaría negativo, se devuelve `STOCK_INSUFFICIENT`.

### 9.4 Configuración

**Actualizar configuración** (`PATCH /admin/settings`)

```json
{
  "transfer_discount_percent": 10,
  "reservation_ttl_hours": 48,
  "bank_account": {
    "holder": "Nombre del comercio",
    "cbu": "0000000000000000000000",
    "alias": "comercio.alias",
    "bank": "Banco"
  }
}
```

Validaciones:

- `transfer_discount_percent`: número entre 0 y 100, con hasta dos decimales.
- `reservation_ttl_hours`: entero entre 1 y 168.
- `cbu`: 22 dígitos. Si es CVU, 22 dígitos también.
- `alias`: entre 6 y 20 caracteres, letras, números, puntos o guiones.

## 10. Errores

### 10.1 Formato

Todos los errores siguen el formato de Medusa, con un código propio agregado:

```json
{
  "type": "invalid_data",
  "code": "TRANSFER_PROOF_TOO_LARGE",
  "message": "El comprobante supera el tamaño máximo de 5 MB.",
  "details": {
    "max_mb": 5,
    "received_mb": 7.4
  }
}
```

| Campo | Descripción |
|---|---|
| `type` | Tipo de Medusa: `invalid_data`, `not_found`, `unauthorized`, `not_allowed`, `conflict`, `unexpected_state`. |
| `code` | Código propio del sistema, estable y pensado para el storefront. |
| `message` | Texto en español, claro para el usuario final o el admin. |
| `details` | Datos adicionales para resolver el problema. Opcional. |

Los mensajes deben explicar qué pasó y cómo recuperarse. Por ejemplo, "El comprobante supera 5 MB. Comprime la imagen o sube un PDF."

### 10.2 Catálogo de códigos

| Código | HTTP | Tipo | Cuándo | Recuperación |
|---|---|---|---|---|
| `STOCK_INSUFFICIENT` | 409 | conflict | No hay stock suficiente para una variante. | Reducir la cantidad o quitar el producto. |
| `VARIANT_INACTIVE` | 409 | conflict | La variante fue desactivada. | Elegir otra combinación de talle y color. |
| `PRODUCT_UNPUBLISHED` | 404 | not_found | El producto fue despublicado. | Volver al catálogo. |
| `DISCOUNT_PAYMENT_MISMATCH` | 422 | not_allowed | El descuento de transferencia se intentó usar con otro medio de pago. | Recalcular el total y reintentar. |
| `PROMOTION_EXPIRED` | 422 | invalid_data | La promoción venció. | Continuar con el precio de lista. |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | unexpected_state | Mercado Pago no respondió. | Reintentar en unos minutos o elegir transferencia. |
| `ORDER_ALREADY_PAID` | 409 | conflict | Se intentó pagar un pedido ya pagado. | Ver el estado del pedido. |
| `RESERVATION_EXPIRED` | 409 | unexpected_state | La reserva de stock venció antes de subir el comprobante. | Crear un pedido nuevo. |
| `TRANSFER_PROOF_TOO_LARGE` | 413 | invalid_data | El comprobante supera el tamaño máximo. | Comprimir la imagen o subir un PDF. |
| `TRANSFER_PROOF_FORMAT_INVALID` | 415 | invalid_data | Formato no permitido. | Subir JPG, PNG o PDF. |
| `TRANSFER_PROOF_ALREADY_SUBMITTED` | 409 | conflict | Ya existe un comprobante para este pedido. | Esperar la revisión del comercio. |
| `TRANSFER_NOT_REVIEWABLE` | 409 | unexpected_state | Se intentó confirmar o rechazar una transferencia en un estado que no lo permite. | Revisar el estado actual. |
| `REJECTION_REASON_REQUIRED` | 422 | invalid_data | El rechazo no tiene motivo válido. | Escribir un motivo de 10 a 300 caracteres. |
| `SALE_ITEMS_EMPTY` | 422 | invalid_data | La venta no tiene productos. | Agregar al menos un producto. |
| `SETTING_INVALID` | 422 | invalid_data | Un valor de configuración no es válido. | Corregir el campo indicado en `details`. |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | unauthorized | La notificación de Mercado Pago no tiene firma válida. | No aplica para el usuario. Se registra y se descarta. |
| `ORDER_TOKEN_INVALID` | 401 | unauthorized | El token de acceso al pedido es incorrecto o venció. | Consultar el pedido desde el enlace del email. |

## 11. Almacenamiento

### 11.1 Base de datos

PostgreSQL es la única fuente de verdad para pedidos, stock, precios y configuración. Las migraciones se gestionan con las herramientas de Medusa. Se hacen copias de seguridad diarias y se prueba la restauración al menos una vez por mes.

### 11.2 Imágenes de producto [Medusa + storage propio]

- Las imágenes se guardan en un servicio compatible con S3, a través del proveedor de archivos de Medusa.
- Son públicas, con caché de CDN.
- Se aceptan JPG, PNG y WebP. Se recomienda generar versiones redimensionadas para la tienda.

**Decidido:** Cloudflare R2 como proveedor. Las imágenes se sirven desde un dominio propio (`imagenes.<dominio-del-cliente>`) que apunta al bucket. Las URLs guardadas en la base usan ese dominio, no el de R2, para que una migración futura a MinIO solo implique cambiar el destino del dominio y las variables de entorno.

**Migración futura a MinIO:** se planifica si el costo o la necesidad de control lo justifican. Antes de elegirlo se revisan sus condiciones de licencia y distribución vigentes. El proceso incluye copiar los objetos entre buckets, verificar que cada URL responda y mantener el dominio durante la transición.

**Variables de entorno:**

```
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=productos-publico
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FILE_URL=https://imagenes.<dominio-del-cliente>
```

**Reglas de carga:** JPG, PNG o WebP; máximo 5 MB por imagen; nombres de archivo generados por el sistema, sin el nombre original.

### 11.3 Comprobantes de transferencia [Propio]

- Se guardan en un bucket **privado**, separado del de imágenes. No se usa el módulo de archivos de Medusa porque acepta un solo proveedor y está pensado para archivos públicos. Un módulo propio usa el SDK de S3 directamente contra R2 para escribir, leer y firmar enlaces.
- Nunca tienen URL pública. El admin accede mediante un enlace firmado con vencimiento corto (15 minutos).
- El nombre del archivo en el storage es un identificador generado, no el nombre original.
- Se valida el tipo MIME real del archivo, no solo la extensión.
- Retención: se conservan mientras el pedido esté activo, y se define una política de borrado para pedidos antiguos antes de producción.

## 12. Autenticación y autorización

### 12.1 Admin [Medusa]

- Usuarios creados desde el panel de Medusa o por el superadmin.
- Autenticación con email y contraseña. El JWT tiene vencimiento configurable.
- Contraseñas almacenadas con hash, según el estándar de Medusa.

### 12.2 Roles del MVP0 [Propio, opción A]

Medusa no ofrece roles con permisos granulares en su versión base, así que el MVP0 usa tres perfiles:

| Perfil | Implementación |
|---|---|
| Superadmin | Usuario marcado como superadmin. Acceso total, incluida la configuración técnica. |
| Admin | Usuario con rol de administrador del comercio. Acceso a todo el panel excepto a la configuración técnica. |
| Vendedor | Usuario con acceso restringido por un middleware propio. Solo puede acceder a ventas en el local, transferencias en modo lectura y pedidos en modo lectura. |

El middleware de rol vendedor se implementa como un guard en las rutas `/admin/*`, con una lista explícita de rutas permitidas. Por defecto, toda ruta no listada está denegada.

**Pendiente de decisión:** si el MVP1 necesita permisos finos, se evaluará una solución de terceros o un módulo propio.

### 12.3 Clientes de la tienda

- Compra como invitado. No hay sesión obligatoria.
- El acceso al pedido se da con un token de un solo uso, incluido en el enlace del email de confirmación.
- En MVP1 se incorporarán cuentas de cliente.

## 13. Notificaciones y emails

Los emails son transaccionales, se disparan desde subscribers de Medusa y usan el proveedor de notificaciones configurado.

| Evento | Destinatario | Contenido |
|---|---|---|
| Pedido creado | Cliente | Número de pedido, total, medio de pago y enlace al pedido. |
| Pedido pagado | Cliente | Confirmación y próximos pasos. |
| Transferencia pendiente | Cliente | Datos bancarios, monto exacto, referencia y fecha de vencimiento de la reserva. |
| Comprobante recibido | Admin | Aviso con enlace al panel. |
| Transferencia confirmada | Cliente | Confirmación de pago. |
| Transferencia rechazada | Cliente | Motivo y enlace para subir un nuevo comprobante. |

**Pendiente:** elegir proveedor de email. Opciones compatibles con Medusa: SendGrid, Resend u otro con proveedor oficial o comunitario.

## 14. Integración con Mercado Pago

### 14.1 Flujo

1. El storefront crea la sesión de pago con el proveedor de Mercado Pago. Medusa devuelve la URL o la preferencia de Checkout Pro.
2. El cliente completa el pago en Mercado Pago.
3. Mercado Pago envía una notificación (webhook) al backend.
4. El backend verifica la firma de la notificación, consulta el estado del pago en la API de Mercado Pago y actualiza el pedido.
5. El storefront consulta el estado del pedido para mostrar la confirmación.

### 14.2 Requisitos de seguridad

- El backend nunca confía en el estado del pago que viene en el navegador. Solo actúa sobre la consulta directa a la API de Mercado Pago.
- Las notificaciones se verifican con la firma que Mercado Pago envía en los headers, usando el secreto configurado.
- Las notificaciones se procesan de forma idempotente. Recibir la misma dos veces no duplica pagos ni stock.
- Si la notificación no llega, un proceso de reconciliación consulta periódicamente los pagos pendientes.

### 14.3 Plugin o proveedor propio

Hay plugins de la comunidad para Medusa que integran Mercado Pago. Antes de adoptar uno, se revisa:

- Fecha del último commit y actividad del mantenedor.
- Compatibilidad con Medusa 2.22.
- Soporte de webhooks con verificación de firma.
- Licencia.

Si ninguno cumple estos criterios, se desarrolla un proveedor propio. El contrato de proveedor de pago de Medusa es acotado, y la mayor parte del trabajo está en las pruebas.

## 15. Seguridad

- HTTPS obligatorio en todos los entornos fuera de desarrollo local.
- Rate limiting en login de admin, creación de carritos y subida de comprobantes.
- Validación de todas las entradas en el backend. El storefront no es una barrera de seguridad.
- Encabezados de seguridad estándar en las respuestas HTTP.
- Logs sin datos sensibles: no se registran CBU, número de documento ni contenido de comprobantes.
- Acceso al panel de administración limitado por IP solo si el dueño lo solicita.
- Política de contraseñas para usuarios del admin: longitud mínima y bloqueo tras intentos fallidos.
- Revisión de dependencias con herramientas de auditoría antes de cada despliegue.

## 16. Datos personales

- Los datos de clientes (nombre, email, teléfono, dirección y documento si se informa) se usan solo para procesar pedidos.
- El sitio debe informar el tratamiento de datos y los derechos del titular, según la normativa argentina vigente.
- Se define una política de retención. Los datos de pedidos se conservan por el plazo que exige la normativa fiscal y contable, y se revisa con el cliente.
- Pendiente: revisar con un profesional los textos legales y la política de privacidad antes del lanzamiento.

## 17. Entornos y despliegue

| Entorno | Propósito | Base de datos | Mercado Pago |
|---|---|---|---|
| Desarrollo | Trabajo diario en local | PostgreSQL local con Docker | Credenciales de prueba |
| Staging | Pruebas con el cliente | PostgreSQL dedicado | Credenciales de prueba |
| Producción | Operación real | PostgreSQL dedicado con respaldos | Credenciales de producción |

- Desarrollo: `docker compose up` levanta PostgreSQL, Redis y el backend.
- Build: imagen Docker del backend y build estático del storefront.
- **Decidido:** backend y base de datos en una VPS administrada con Coolify. El storefront se despliega en Vercel.
- Coolify crea un proyecto con cuatro servicios: backend (servidor HTTP), worker (tareas en segundo plano), PostgreSQL y Redis. Backend y worker usan la misma imagen Docker con distinto modo de arranque, según la guía de la comunidad. Confirmar en la documentación de Medusa.
- Docker es obligatorio en el proyecto: `Dockerfile` para el backend y `docker-compose.yml` para desarrollo local con PostgreSQL y Redis.
- Copias de seguridad de PostgreSQL a almacenamiento externo (R2, en un bucket separado) con retención definida. Las copias de la VPS no alcanzan.
- Actualizaciones de seguridad del sistema operativo y de Coolify, con ventana de mantenimiento fijada.
- Migraciones: se ejecutan antes de cada despliegue, con un paso de verificación.
- Rollback: cada despliegue conserva la versión anterior de la imagen. La base de datos se restaura desde el último respaldo si una migración falla.

## 18. Observabilidad

- Logs estructurados en JSON, con nivel, timestamp, identificador de pedido y de solicitud.
- Métricas básicas: pedidos creados por hora, pagos aprobados y rechazados, comprobantes pendientes, errores 5xx.
- Alertas por errores de pago recurrentes, fallas de conexión con Mercado Pago y caída del backend.
- Monitoreo externo de disponibilidad de la tienda y del panel.

## 19. Pruebas

| Tipo | Alcance | Herramienta |
|---|---|---|
| Unitarias | Cálculo de precio por transferencia, validación de DTOs, transiciones de estado. | Jest o Vitest |
| Integración | Endpoints propios, proveedor de transferencia, hook de validación de descuento. | Test de Medusa + base de datos de prueba |
| Flujo end-to-end | Compra con tarjeta y con transferencia, venta en el local, confirmación y rechazo de comprobantes. | Playwright |
| Carga | Concurrencia en la reserva de stock para verificar que no haya sobreventa. | k6 |

Criterios mínimos antes de producción:

- Ningún pedido puede quedar con stock negativo.
- Ningún descuento de transferencia se aplica con tarjeta.
- Toda notificación de Mercado Pago se procesa una sola vez.
- Todo error expuesto al usuario tiene un código de la sección 10.

## 20. Decisiones pendientes

| Tema | Opciones | Recomendación |
|---|---|---|
| Plugin de Mercado Pago | Comunidad o proveedor propio | Evaluar plugins con los criterios de la sección 14.3. Si fallan, proveedor propio. |
| Storage de imágenes | Cloudflare R2, AWS S3 | **Cerrado:** Cloudflare R2, con migración futura a MinIO si hace falta. |
| Proveedor de email | SendGrid, Resend | Según disponibilidad de cuenta del cliente. |
| Hosting | VPS con Docker, Medusa Cloud | **Cerrado:** Coolify sobre VPS para backend y base; Vercel para el storefront. |
| Dominio | — | Pendiente. |
| Permisos finos | Módulo propio o solución de terceros | MVP1. |
| Política de retención de comprobantes | Por antigüedad o por estado | Definir con el cliente antes de producción. |

## 21. Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-10-23 | Primera versión del documento de arquitectura. |
| 2026-10-23 | Stack de storefront definido (Next.js 16.4.3, Tailwind, shadcn/ui, Phosphor, Zustand, TanStack Query, Storybook). Imágenes en Cloudflare R2 con dominio propio. Comprobantes en bucket privado con módulo propio. Despliegue en Coolify sobre VPS, storefront en Vercel. |
