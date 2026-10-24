/**
 * El listado nativo de pedidos de Medusa 2.22 filtra por región, canal y fechas, pero
 * no por estado de pago (planning.md, HU-32): ni siquiera su API respeta
 * `payment_status`, porque se calcula y no es una columna. Estos grupos agrupan los
 * estados de Medusa en lo que el dueño necesita ver.
 */
export const PAYMENT_GROUPS = {
  unpaid: { label: "Sin pagar", statuses: ["not_paid", "awaiting", "authorized", "partially_authorized", "requires_action"] },
  paid: { label: "Pagado", statuses: ["captured", "partially_captured"] },
  refunded: { label: "Reembolsado", statuses: ["partially_refunded", "refunded"] },
  canceled: { label: "Cancelado", statuses: ["canceled"] },
} as const

export type PaymentGroup = keyof typeof PAYMENT_GROUPS

export function paymentGroupOf(status: string): string {
  const group = Object.values(PAYMENT_GROUPS).find((item) => (item.statuses as readonly string[]).includes(status))
  return group ? group.label : status
}
