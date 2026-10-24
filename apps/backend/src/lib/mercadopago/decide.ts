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

/**
 * Entre los pagos de una referencia, uno aprobado que coincide con lo esperado; si no hay,
 * cualquier aprobado (para informar el desajuste); si no, el más nuevo. Así un pago ajeno
 * más nuevo con otro monto no tapa al correcto.
 */
export function pickPayment<T extends MpPayment>(
  payments: T[],
  expected: { amount: number; currency: string; reference: string }
): T | null {
  const approved = payments.filter((payment) => payment.status === "approved")
  const matching = approved.find((payment) => evaluatePayment(payment, expected).problem === null)
  return matching ?? approved[0] ?? payments[0] ?? null
}

/**
 * Un segundo pago aprobado para una referencia que ya cobró otro es un cobro doble: hay
 * que devolverlo (planning.md, HU-25).
 */
export function isDuplicateApproval(input: { payment: MpPayment; capturedPaymentId: string | null }): boolean {
  return (
    input.payment.status === "approved" &&
    input.capturedPaymentId !== null &&
    String(input.payment.id) !== input.capturedPaymentId
  )
}

/** Solo las referencias que arma esta tienda (id de sesión de pago de Medusa). */
export function isOurReference(reference: string | null | undefined): reference is string {
  return typeof reference === "string" && /^payses_[A-Za-z0-9]{10,}$/.test(reference)
}
