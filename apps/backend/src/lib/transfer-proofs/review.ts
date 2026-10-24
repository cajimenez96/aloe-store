export type ReasonResult = { ok: true; reason: string } | { ok: false }

/** Motivo de rechazo visible para el cliente: entre 10 y 300 caracteres (planning.md, HU-29). */
export function validateRejectionReason(value: unknown): ReasonResult {
  if (typeof value !== "string") return { ok: false }
  const reason = value.trim()
  return reason.length >= 10 && reason.length <= 300 ? { ok: true, reason } : { ok: false }
}

/** Un comprobante ya revisado no se puede volver a revisar. */
export function canReview(status: string): boolean {
  return status === "pending_review"
}
