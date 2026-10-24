import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { notifyOrderCanceled } from "../lib/notifications/order-emails"

// Aviso de cancelación al cliente (planning.md, HU-42), venga del panel o del job de vencimiento.
export default async function orderCanceledHandler({ event, container }: SubscriberArgs<{ id: string }>) {
  await notifyOrderCanceled(container, event.data.id)
}

export const config: SubscriberConfig = { event: "order.canceled" }
