import { hashToken, verifyToken } from "./token"

const MAX_TOKENS = 5

/**
 * Cada email del pedido lleva su propio token, y como solo se guarda el hash no se
 * puede repetir uno anterior. Los hashes se acumulan en la metadata (máximo 5, se
 * descartan los más viejos) y todos siguen valiendo (seguridad.md, SEC-24).
 */
export function addTokenHash(metadata: Record<string, unknown>, hash: string): Record<string, unknown> {
  const current = Array.isArray(metadata.access_token_hashes)
    ? (metadata.access_token_hashes as unknown[]).filter((h): h is string => typeof h === "string")
    : []
  return { ...metadata, access_token_hashes: [...current, hash].slice(-MAX_TOKENS) }
}

export function tokenMatches(token: string, metadata: Record<string, unknown>): boolean {
  const hashes = Array.isArray(metadata.access_token_hashes) ? (metadata.access_token_hashes as unknown[]) : []
  // Se recorre la lista completa para que el tiempo no dependa de cuál coincide.
  let matched = false
  for (const hash of hashes) {
    if (verifyToken(token, typeof hash === "string" ? hash : null)) matched = true
  }
  if (hashes.length === 0) verifyToken(token, null)
  return matched
}

export { hashToken }
