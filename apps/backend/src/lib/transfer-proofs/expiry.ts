/**
 * Decide si un pedido por transferencia se cancela por vencimiento (planning.md,
 * HU-30): pendiente, con la fecha pasada y sin un comprobante en revisión ni
 * aceptado.
 */
export function shouldExpire(input: {
  status: string
  method: string | null
  dueAt: Date | null
  proofs: { status: string }[]
  now?: Date
}): boolean {
  const now = input.now ?? new Date()
  if (input.status !== "pending" || input.method !== "transfer" || !input.dueAt) return false
  if (input.dueAt.getTime() >= now.getTime()) return false
  return !input.proofs.some((proof) => proof.status === "pending_review" || proof.status === "accepted")
}
