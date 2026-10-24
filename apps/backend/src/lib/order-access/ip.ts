/**
 * IP del cliente para el límite de pedidos (seguridad.md, SEC-40). Medusa confía
 * en un salto de proxy y `req.ip` sale de `X-Forwarded-For`, que el cliente puede
 * inventar. Por eso se ignora ese header salvo que se declare cuántos proxies de
 * confianza hay delante (`TRUSTED_PROXY_HOPS`): cada uno agrega la IP que vio al
 * final de la lista, así que se toma desde la derecha.
 */
export function clientIp(input: {
  remoteAddress: string | undefined
  forwardedFor: string | undefined
  trustedHops: number
}): string | undefined {
  if (input.trustedHops > 0 && input.forwardedFor) {
    const entries = input.forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
    const picked = entries[entries.length - input.trustedHops]
    if (picked) return picked
  }
  return input.remoteAddress
}

export function trustedHopsFromEnv(value: string | undefined): number {
  const hops = Number(value)
  return Number.isInteger(hops) && hops > 0 && hops <= 5 ? hops : 0
}
