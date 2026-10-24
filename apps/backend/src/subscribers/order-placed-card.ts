import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notifyOrderPaid } from "../lib/notifications/order-emails"

// Un pedido con tarjeta se crea cuando llega el pago (arquitectura.md, 10.2), sin pasar por la
// ruta de confirmación de las transferencias: acá se avisa al cliente con el enlace a su pedido.
export default async function orderPlacedCard({ event, container }: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: event.data.id } })
  if ((order?.metadata as Record<string, unknown> | null)?.payment_method !== "card") return
  await notifyOrderPaid(container, order.id)
}

export const config: SubscriberConfig = { event: "order.placed" }
