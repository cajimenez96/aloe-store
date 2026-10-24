import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

const TOKEN_BYTES = 32
const CLOSED_TOKEN_DAYS = 30
const HASH_PATTERN = /^[a-f0-9]{64}$/

/** Token aleatorio de 32 bytes para el enlace del pedido (seguridad.md, SEC-24). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url")
}

/** En la base solo se guarda este hash, nunca el token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Compara el token recibido con el hash guardado en tiempo constante. Un pedido
 * sin hash rechaza igual, para que la respuesta sea la misma exista o no.
 */
export function verifyToken(token: string, storedHash: string | null | undefined): boolean {
  const expected = Buffer.from(
    storedHash && HASH_PATTERN.test(storedHash) ? storedHash : "0".repeat(64),
    "hex"
  )
  const received = Buffer.from(hashToken(token), "hex")
  const equal = timingSafeEqual(received, expected)
  return equal && Boolean(storedHash) && HASH_PATTERN.test(storedHash as string)
}

/** El token sirve mientras el pedido está abierto y hasta 30 días después de cerrarse. */
export function isTokenExpired(
  order: { status: string; updatedAt: Date },
  now: Date = new Date()
): boolean {
  if (order.status !== "completed" && order.status !== "canceled") return false
  return now.getTime() - order.updatedAt.getTime() > CLOSED_TOKEN_DAYS * 86_400_000
}
