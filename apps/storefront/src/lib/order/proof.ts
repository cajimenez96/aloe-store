export const MAX_PROOF_BYTES = 5 * 1024 * 1024

export type ProofStatus = {
  status: "pending_review" | "accepted" | "rejected"
  rejection_reason: string | null
}

const MESSAGES: Record<string, string> = {
  TRANSFER_PROOF_TOO_LARGE: "El archivo supera los 5 MB. Comprimí la imagen o subí un PDF.",
  TRANSFER_PROOF_FORMAT_INVALID: "Formato no permitido. Subí un JPG, PNG o PDF.",
  TRANSFER_PROOF_PENDING: "Ya hay un comprobante en revisión. Esperá la respuesta del comercio.",
  ORDER_EXPIRED: "El pedido venció. Hacé un pedido nuevo.",
  ORDER_ALREADY_PAID: "Este pedido ya está pagado.",
  TOO_MANY_UPLOADS: "Subiste demasiados comprobantes en poco tiempo. Probá más tarde.",
  ORDER_ACCESS_DENIED: "No pudimos validar tu acceso. Entrá con el enlace que te enviamos por email.",
}

/** Texto del catálogo para un error de la subida; nunca el mensaje interno (arquitectura.md, sección 15). */
export function proofErrorMessage(code: unknown): string {
  return (typeof code === "string" && MESSAGES[code]) || "No pudimos subir el comprobante. Probá de nuevo."
}

/** Estado del último comprobante, o null si todavía no subió ninguno (planning.md, HU-28). */
export function proofStatusLabel(proof: ProofStatus | null): string | null {
  if (!proof) return null
  if (proof.status === "pending_review") return "Recibimos tu comprobante y lo estamos revisando."
  if (proof.status === "accepted") return "Pago confirmado. ¡Gracias!"
  const reason = (proof.rejection_reason ?? "sin detalle").trim().replace(/[.!?]+$/, "")
  return `Rechazamos tu comprobante. Motivo: ${reason}. Podés subir otro.`
}
