export type ProofStatus = "pending_review" | "accepted" | "rejected"

export type UploadBlocker =
  | "ORDER_EXPIRED"
  | "TRANSFER_PROOF_PENDING"
  | "ORDER_ALREADY_PAID"
  | "TOO_MANY_UPLOADS"

const MAX_UPLOADS_PER_HOUR = 5

/**
 * Qué impide subir un comprobante nuevo, o null si se puede (planning.md, HU-28):
 * pedido cancelado o vencido, ya pagado, otro comprobante en revisión, o más de
 * 5 subidas en la última hora (SEC-17).
 */
export function uploadBlocker(input: {
  order: { status: string; dueAt: Date | null }
  proofs: { status: string; createdAt: Date }[]
  now?: Date
}): UploadBlocker | null {
  const now = input.now ?? new Date()
  const { order, proofs } = input

  if (proofs.some((proof) => proof.status === "accepted")) return "ORDER_ALREADY_PAID"
  if (proofs.some((proof) => proof.status === "pending_review")) return "TRANSFER_PROOF_PENDING"
  if (order.status !== "pending" || (order.dueAt && order.dueAt.getTime() < now.getTime())) {
    return "ORDER_EXPIRED"
  }

  const lastHour = proofs.filter((proof) => now.getTime() - proof.createdAt.getTime() <= 3_600_000)
  if (lastHour.length >= MAX_UPLOADS_PER_HOUR) return "TOO_MANY_UPLOADS"
  return null
}
