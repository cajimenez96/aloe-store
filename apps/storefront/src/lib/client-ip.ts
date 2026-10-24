import { headers } from "next/headers"

const IP_PATTERN = /^[0-9a-fA-F:.]{3,45}$/

/**
 * IP del cliente a reenviar al backend. El storefront llama al backend desde su
 * servidor, así que sin esto todos los clientes parecerían tener la misma IP y los
 * límites de seguridad.md (SEC-17 y SEC-40) se aplicarían a todos juntos. Solo se
 * lee `X-Forwarded-For` si se declara cuántos proxies de confianza hay delante
 * (`TRUSTED_PROXY_HOPS`) y se toma la entrada que agregó el más cercano.
 */
export function forwardedIp(input: { forwardedFor: string | undefined; hops: number }): string | undefined {
  if (input.hops < 1 || !input.forwardedFor) return undefined
  const entries = input.forwardedFor
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
  const picked = entries[entries.length - input.hops]
  return picked && IP_PATTERN.test(picked) ? picked : undefined
}

/** Encabezado para las llamadas al backend que dependen de la IP del cliente. */
export async function clientIpHeaders(): Promise<Record<string, string>> {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS)
  const ip = forwardedIp({
    forwardedFor: (await headers()).get("x-forwarded-for") ?? undefined,
    hops: Number.isInteger(hops) ? hops : 0,
  })
  return ip ? { "x-forwarded-for": ip } : {}
}
