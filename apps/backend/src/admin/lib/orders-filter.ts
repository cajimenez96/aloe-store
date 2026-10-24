import { PAYMENT_GROUPS } from "../../lib/orders/payment-groups"

export { PAYMENT_GROUPS, paymentGroupOf } from "../../lib/orders/payment-groups"

export const ORDERS_PAGE_SIZE = 25

/** Consulta al endpoint propio de pedidos (el nativo no filtra por estado de pago). */
export function buildOrdersQuery(input: { channelId: string; group: string; offset: number }): string {
  const params = [`limit=${ORDERS_PAGE_SIZE}`, `offset=${input.offset}`]
  if (input.channelId) params.push(`sales_channel_id=${encodeURIComponent(input.channelId)}`)
  if (input.group in PAYMENT_GROUPS) params.push(`payment_group=${input.group}`)
  return params.join("&")
}
