type Bank = { holder: string; cbu: string; alias: string; bank: string }

type OrderDetail = {
  order: {
    id: string
    display_id: number
    status: string
    currency_code: string
    created_at: string
    customer_first_name: string | null
    items: {
      title: string
      variant_title: string | null
      quantity: number
      unit_price: number
      total: number
    }[]
    shipping: { name: string | null }
    subtotal: number
    discount_total: number
    total: number
  }
  payment: {
    method: string | null
    reference: string | null
    due_at: string | null
    bank_account: Bank | null
    status?: "paid" | "pending"
  }
}

export type OrderView = {
  id: string
  number: number
  status: string
  currencyCode: string
  firstName: string | null
  items: { title: string; variantTitle: string | null; quantity: number; unitPrice: number; total: number }[]
  shippingName: string | null
  subtotal: number
  discount: number
  total: number
  paymentMethod: string | null
  /** El pago ya se confirmó (comprobante aceptado o tarjeta aprobada). */
  paid: boolean
  /** Datos para pagar; solo mientras el pedido por transferencia está pendiente. */
  transfer: { reference: string; dueAt: Date | null; bank: Bank } | null
}

/** La vista del pedido: todos los montos los calculó Medusa. */
export function buildOrderView(detail: OrderDetail): OrderView {
  const { order, payment } = detail
  const paid = payment.status === "paid"
  const pays = !paid && payment.method === "transfer" && payment.bank_account && payment.reference
  return {
    id: order.id,
    number: order.display_id,
    status: order.status,
    currencyCode: order.currency_code,
    firstName: order.customer_first_name,
    items: order.items.map((item) => ({
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    })),
    shippingName: order.shipping.name,
    subtotal: order.subtotal,
    discount: order.discount_total,
    total: order.total,
    paymentMethod: payment.method,
    paid,
    transfer: pays
      ? {
          reference: payment.reference as string,
          dueAt: payment.due_at ? new Date(payment.due_at) : null,
          bank: payment.bank_account as Bank,
        }
      : null,
  }
}

export const isOrderId = (value: string) => /^[A-Za-z0-9_]{1,100}$/.test(value)

/** Token de 32 bytes en base64url (43 caracteres); se acepta un margen. */
export const isOrderToken = (value: string) => /^[A-Za-z0-9_-]{32,100}$/.test(value)

/** Cada pedido tiene su cookie, así que dos pedidos en un navegador no se pisan. */
export const orderCookieName = (orderId: string) => `aloe_order_${orderId}`

/** Misma política que la cookie del carrito: HttpOnly, SameSite=Lax y Secure con HTTPS (SEC-61). */
export function orderCookieOptions(backendUrl: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: backendUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}
