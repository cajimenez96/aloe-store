import { PAYMENT_GROUPS, type PaymentGroup } from "./payment-groups"

/** Filtra por grupo de estado de pago y recorta la página; `count` es el total ya filtrado. */
export function pageOrders<T extends { payment_status?: string | null }>(input: {
  orders: T[]
  group: string
  offset: number
  limit: number
}): { orders: T[]; count: number } {
  const group = PAYMENT_GROUPS[input.group as PaymentGroup]
  const filtered = group
    ? input.orders.filter((order) => (group.statuses as readonly string[]).includes(order.payment_status ?? ""))
    : input.orders
  return { orders: filtered.slice(input.offset, input.offset + input.limit), count: filtered.length }
}
