import { evaluatePayment, type MpPayment } from "./payment"

export type Decision =
  | { action: "capture"; paymentId: string }
  | { action: "noop" }
  | { action: "pending" }
  | { action: "rejected" }
  | { action: "refunded" }
  | { action: "mismatch"; problem: "PAYMENT_AMOUNT_MISMATCH" }

/**
 * Qué hacer con un pago consultado a Mercado Pago (planning.md, HU-25 y HU-26). Es la
 * misma decisión para el webhook, el job de conciliación y la consulta del regreso:
 * el estado sale siempre de la API y nunca de la notificación (seguridad.md, SEC-32).
 * `session.done` indica que ya se capturó, así que repetir la notificación no duplica nada.
 */
export function decideSettlement(input: {
  session: { id: string; amount: number; currency: string; done: boolean }
  payment: MpPayment | null
}): Decision {
  const { session, payment } = input
  if (session.done) return { action: "noop" }
  if (!payment) return { action: "pending" }

  const evaluated = evaluatePayment(payment, { amount: session.amount, currency: session.currency, reference: session.id })
  if (evaluated.problem) return { action: "mismatch", problem: evaluated.problem }
  switch (evaluated.state) {
    case "approved":
      return { action: "capture", paymentId: String(payment.id) }
    case "rejected":
      return { action: "rejected" }
    case "refunded":
      return { action: "refunded" }
    default:
      return { action: "pending" }
  }
}

/** Entre los pagos de una referencia, uno aprobado si lo hay; si no, el más nuevo. */
export function pickPayment<T extends { status?: string }>(payments: T[]): T | null {
  return payments.find((payment) => payment.status === "approved") ?? payments[0] ?? null
}
