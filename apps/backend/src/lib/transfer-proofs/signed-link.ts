import { createHmac, timingSafeEqual } from "node:crypto"

const TTL_MS = 15 * 60_000

const mac = (proofId: string, expires: number, secret: string) =>
  createHmac("sha256", secret).update(`transfer-proof:${proofId}:${expires}`).digest("hex")

/** Enlace de 15 minutos para ver un comprobante (seguridad.md, SEC-51). */
export function signProofLink(proofId: string, secret: string, now: Date = new Date()): string {
  const expires = now.getTime() + TTL_MS
  return `${expires}.${mac(proofId, expires, secret)}`
}

export function verifyProofLink(proofId: string, token: string, secret: string, now: Date = new Date()): boolean {
  const parts = token.split(".")
  if (parts.length !== 2) return false
  const expires = Number(parts[0])
  if (!Number.isInteger(expires) || expires < now.getTime()) return false

  // La firma es SHA-256 en hexadecimal: 64 caracteres exactos, nada más.
  if (!/^[a-f0-9]{64}$/.test(parts[1])) return false
  const expected = Buffer.from(mac(proofId, expires, secret), "hex")
  const received = Buffer.from(parts[1], "hex")
  return received.length === expected.length && timingSafeEqual(received, expected)
}
