import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { issueOrderLink } from "../order-access/issue"
import { mergeSettings } from "../store-settings/validation"
import { sendEmail } from "./send-email"

const formatMoney = (amount: unknown) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(
    MathBN.convert(amount as never).toNumber()
  )

async function loadOrder(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "metadata", "items.title", "items.variant_title", "items.quantity", "shipping_address.first_name"],
    filters: { id: orderId },
  })
  return order ?? null
}

/** Pedido pagado (planning.md, HU-39): solo datos del propio pedido y un enlace con token nuevo. */
export async function notifyOrderPaid(container: MedusaContainer, orderId: string) {
  const order = await loadOrder(container, orderId)
  if (!order?.email) return
  const link = await issueOrderLink(container, orderId)
  if (!link) return

  const items = (order.items ?? [])
    .map((item) => `${MathBN.convert((item?.quantity ?? 0) as never).toNumber()} × ${item?.title}${item?.variant_title ? ` (${item.variant_title})` : ""}`)
    .join(", ")
  const method = (order.metadata as Record<string, unknown> | null)?.payment_method

  await sendEmail(container, {
    to: order.email,
    template: "order-paid",
    data: {
      name: order.shipping_address?.first_name ?? "",
      orderNumber: String(order.display_id),
      items,
      total: formatMoney(order.total),
      paymentMethod: method === "card" ? "Tarjeta" : "Transferencia",
      link,
    },
  })
}

/** Comprobante rechazado (HU-42): el motivo y un enlace para subir otro. */
export async function notifyProofRejected(container: MedusaContainer, orderId: string, reason: string) {
  const order = await loadOrder(container, orderId)
  if (!order?.email) return
  const link = await issueOrderLink(container, orderId)
  if (!link) return

  await sendEmail(container, {
    to: order.email,
    template: "proof-rejected",
    data: {
      name: order.shipping_address?.first_name ?? "",
      orderNumber: String(order.display_id),
      reason,
      link,
    },
  })
}

/** Pedido cancelado (HU-42): por vencimiento o por el comercio. */
export async function notifyOrderCanceled(container: MedusaContainer, orderId: string) {
  const order = await loadOrder(container, orderId)
  if (!order?.email) return
  const cause = (order.metadata as Record<string, unknown> | null)?.cancel_reason === "expired" ? "expired" : "store"

  await sendEmail(container, {
    to: order.email,
    template: "order-canceled",
    data: {
      name: order.shipping_address?.first_name ?? "",
      orderNumber: String(order.display_id),
      cause,
    },
  })
}

/** Aviso al admin (HU-41): sin comprobante adjunto ni datos bancarios, solo el enlace a la cola. */
export async function notifyAdminProofReceived(container: MedusaContainer, orderNumber: number) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
  const to = mergeSettings(store?.metadata).admin_notification_email
  if (!to) return

  const backend = (process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000").replace(/\/+$/, "")
  await sendEmail(container, {
    to,
    template: "proof-received-admin",
    data: { orderNumber: String(orderNumber), link: `${backend}/app/comprobantes` },
  })
}

/** Pago devuelto porque se agotó el stock entre el pago y la confirmación (planning.md, HU-24). */
export async function notifyPaymentRefunded(container: MedusaContainer, cartId: string, amount: number) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [cart],
  } = await query.graph({ entity: "cart", fields: ["id", "email", "shipping_address.first_name"], filters: { id: cartId } })
  if (!cart?.email) return
  await sendEmail(container, {
    to: cart.email,
    template: "payment-refunded",
    data: { name: cart.shipping_address?.first_name ?? "", amount: formatMoney(amount) },
  })
}
