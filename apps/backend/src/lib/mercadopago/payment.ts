export type PaymentState = "approved" | "pending" | "rejected" | "refunded"

/** Pago tal como lo devuelve la API de Mercado Pago (solo lo que se usa). */
export type MpPayment = {
  id: number | string
  status?: string
  transaction_amount?: number
  currency_id?: string
  external_reference?: string | null
}

export function mapStatus(status: string | undefined): PaymentState {
  switch (status) {
    case "approved":
      return "approved"
    case "rejected":
    case "cancelled":
      return "rejected"
    case "refunded":
    case "charged_back":
      return "refunded"
    default:
      // pending, in_process, authorized y cualquier estado nuevo: no es un cobro confirmado.
      return "pending"
  }
}

const cents = (value: number) => Math.round(value * 100)

/**
 * Compara el pago consultado a la API con lo que espera el pedido (seguridad.md,
 * SEC-32; planning.md, HU-25): monto, moneda y referencia. Un pago aprobado que no
 * coincide no se marca como cobrado y se informa PAYMENT_AMOUNT_MISMATCH.
 */
export function evaluatePayment(
  payment: MpPayment,
  expected: { amount: number; currency: string; reference: string }
): { state: PaymentState; problem: "PAYMENT_AMOUNT_MISMATCH" | null } {
  const state = mapStatus(payment.status)
  if (state !== "approved") return { state, problem: null }

  const amountOk =
    typeof payment.transaction_amount === "number" &&
    Number.isFinite(payment.transaction_amount) &&
    cents(payment.transaction_amount) === cents(expected.amount)
  const currencyOk = typeof payment.currency_id === "string" && payment.currency_id.toUpperCase() === expected.currency.toUpperCase()
  const referenceOk = payment.external_reference === expected.reference

  return { state, problem: amountOk && currencyOk && referenceOk ? null : "PAYMENT_AMOUNT_MISMATCH" }
}
