import { z } from "zod"

type MedusaLine = {
  id: string
  variant_id?: string | null
  product_id?: string | null
  product_title?: string | null
  product_handle?: string | null
  variant_title?: string | null
  thumbnail?: string | null
  quantity: number
  unit_price: number
  total: number
}

export type CartInput = {
  id: string
  currency_code: string
  /** Productos solos. El `subtotal` de Medusa ya suma el envío. */
  item_subtotal?: number | null
  subtotal?: number | null
  shipping_total?: number | null
  total: number
  items?: MedusaLine[] | null
}

export type CartLine = {
  id: string
  variantId: string
  productId: string
  title: string
  variantTitle: string | null
  handle: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: number
  total: number
}

export type CartView = {
  id: string | null
  currencyCode: string
  lines: CartLine[]
  itemCount: number
  subtotal: number
  shippingTotal: number
  /** Total calculado por Medusa, en la unidad de la moneda. */
  total: number
}

/** Lo que muestra el carrito, a partir de la respuesta de Medusa (que calcula todos los montos). */
export function buildCartView(cart: CartInput | null | undefined): CartView {
  if (!cart) {
    return { id: null, currencyCode: "ars", lines: [], itemCount: 0, subtotal: 0, shippingTotal: 0, total: 0 }
  }
  const lines = (cart.items ?? []).map((item) => ({
    id: item.id,
    variantId: item.variant_id ?? "",
    productId: item.product_id ?? "",
    title: item.product_title ?? "Producto",
    variantTitle: item.variant_title ?? null,
    handle: item.product_handle ?? null,
    imageUrl: item.thumbnail ?? null,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    total: item.total,
  }))
  return {
    id: cart.id,
    currencyCode: cart.currency_code,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: cart.item_subtotal ?? cart.subtotal ?? cart.total,
    shippingTotal: cart.shipping_total ?? 0,
    total: cart.total,
  }
}

/**
 * Líneas cuyo producto ya no figura entre los publicados de la tienda
 * (planning.md, HU-18: VARIANT_UNAVAILABLE). Se quitan del carrito con un aviso.
 */
export function findUnavailableLines(lines: CartLine[], publishedProductIds: Set<string>): CartLine[] {
  return lines.filter((line) => !line.productId || !publishedProductIds.has(line.productId))
}

export type CartError = { code: string; message: string }

function details(message: unknown): Record<string, unknown> {
  if (typeof message !== "string") return {}
  try {
    const parsed: unknown = JSON.parse(message)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Traduce un error de la API de carrito a un texto para el cliente
 * (arquitectura.md, sección 15.2). Un error que no se reconoce no deja pasar el
 * mensaje de Medusa, que puede traer detalles internos.
 */
export function parseCartError(body: { code?: unknown; message?: unknown }): CartError {
  const info = details(body.message)

  switch (body.code) {
    case "STOCK_INSUFFICIENT": {
      const available = typeof info.available === "number" ? info.available : null
      return {
        code: "STOCK_INSUFFICIENT",
        message:
          available === null
            ? "No hay stock suficiente. Reducí la cantidad o elegí otra variante."
            : available <= 0
              ? "Esta variante está agotada. Elegí otra."
              : `Solo quedan ${available} unidades. Reducí la cantidad o elegí otra variante.`,
      }
    }
    case "MAX_UNITS_EXCEEDED": {
      const max = typeof info.max_units_per_variant === "number" ? info.max_units_per_variant : null
      return {
        code: "MAX_UNITS_EXCEEDED",
        message:
          max === null
            ? "Superaste el máximo de unidades por variante. Reducí la cantidad o comprá en el local."
            : `Podés comprar hasta ${max} unidades de cada variante online. Para más, acercate al local.`,
      }
    }
    case "VARIANT_UNAVAILABLE":
      return {
        code: "VARIANT_UNAVAILABLE",
        message: "Esta combinación ya no está disponible. Elegí otra.",
      }
    case "PENDING_ORDERS_LIMIT":
      return {
        code: String(body.code),
        message: "Ya tenés pedidos pendientes de pago. Completá o esperá el vencimiento de uno anterior.",
      }
    case "PAYMENT_METHOD_REQUIRED":
      return { code: String(body.code), message: "Elegí cómo querés pagar para confirmar el pedido." }
    case "PAYMENT_PROVIDER_UNAVAILABLE":
      return { code: String(body.code), message: "Ese medio de pago no está disponible por ahora. Probá con otro." }
    case "CHECKOUT_INCOMPLETE":
      return { code: String(body.code), message: "Completá tus datos y la forma de entrega para confirmar." }
    case "CART_ALREADY_COMPLETED":
      return { code: String(body.code), message: "Este pedido ya fue confirmado. Revisá tu email." }
    case "DISCOUNT_PAYMENT_MISMATCH":
      return {
        code: String(body.code),
        message: "El descuento por transferencia solo vale si pagás por transferencia. Volvé a elegir el medio de pago.",
      }
    default:
      return {
        code: "CART_ERROR",
        message: "No pudimos actualizar el carrito. Probá de nuevo en un momento.",
      }
  }
}

const inputSchema = z.object({
  variantId: z.string().regex(/^[A-Za-z0-9_]{1,100}$/),
  quantity: z.number().int().min(1).max(99),
})

/**
 * Valida lo que llega a una Server Action del carrito. Solo pasan la variante y
 * la cantidad: el storefront nunca envía precios (seguridad.md, SEC-30 y SEC-61).
 */
export function parseCartInput(raw: unknown): { variantId: string; quantity: number } | null {
  const result = inputSchema.safeParse(raw)
  return result.success ? result.data : null
}

export const CART_COOKIE = "aloe_cart"

/** `Secure` se exige al desplegar con HTTPS; en local por HTTP el navegador la descartaría. */
export function cartCookieOptions(backendUrl: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: backendUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}
