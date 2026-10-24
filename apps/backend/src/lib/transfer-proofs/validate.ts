export const MAX_PROOF_BYTES = 5 * 1024 * 1024

export type ProofKind = "jpg" | "png" | "pdf"

export type ProofValidation =
  | { ok: true; kind: ProofKind; mime: string }
  | { ok: false; code: "TRANSFER_PROOF_TOO_LARGE" | "TRANSFER_PROOF_FORMAT_INVALID" }

const startsWith = (buffer: Buffer, bytes: number[]) =>
  buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)

/**
 * Valida un comprobante por su contenido y no por el nombre ni el tipo que declara
 * el cliente: JPG, PNG o PDF de hasta 5 MB (seguridad.md, SEC-51).
 */
export function validateProofFile(buffer: Buffer): ProofValidation {
  if (buffer.length > MAX_PROOF_BYTES) return { ok: false, code: "TRANSFER_PROOF_TOO_LARGE" }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { ok: true, kind: "jpg", mime: "image/jpeg" }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, kind: "png", mime: "image/png" }
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, kind: "pdf", mime: "application/pdf" }
  return { ok: false, code: "TRANSFER_PROOF_FORMAT_INVALID" }
}
