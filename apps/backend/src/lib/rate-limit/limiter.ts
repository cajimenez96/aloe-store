export type Rule = { limit: number; windowSeconds: number }
export type Limits = { login: Rule; checkout: Rule; store: Rule }

/** Valores iniciales de seguridad.md, SEC-17. */
export const DEFAULT_LIMITS: Limits = {
  login: { limit: 5, windowSeconds: 60 },
  checkout: { limit: 10, windowSeconds: 60 },
  store: { limit: 120, windowSeconds: 60 },
}

const validRule = (value: unknown): value is Rule => {
  if (!value || typeof value !== "object") return false
  const { limit, windowSeconds } = value as Record<string, unknown>
  return (
    Number.isInteger(limit) &&
    (limit as number) >= 1 &&
    (limit as number) <= 100_000 &&
    Number.isInteger(windowSeconds) &&
    (windowSeconds as number) >= 1 &&
    (windowSeconds as number) <= 86_400
  )
}

/**
 * Lee los límites de `RATE_LIMITS` (JSON), por ejemplo
 * `{"login":{"limit":3,"windowSeconds":30}}`. Una entrada inválida se ignora y
 * queda el valor por defecto: una configuración rota no deja la tienda sin límites.
 */
export function parseLimits(raw: string | undefined): Limits {
  if (!raw) return DEFAULT_LIMITS
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_LIMITS
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_LIMITS
  const input = parsed as Record<string, unknown>
  return {
    login: validRule(input.login) ? input.login : DEFAULT_LIMITS.login,
    checkout: validRule(input.checkout) ? input.checkout : DEFAULT_LIMITS.checkout,
    store: validRule(input.store) ? input.store : DEFAULT_LIMITS.store,
  }
}

type Result = { allowed: boolean; retryAfterSeconds: number }

/**
 * Ventana deslizante en memoria por ruta e IP. Solo vale para una instancia: al
 * desplegar con varias se mueve a Redis o al proxy (seguridad.md, SEC-17).
 */
export class RateLimiter {
  private hits = new Map<string, { times: number[]; windowMs: number }>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 50_000
  ) {}

  hit(bucket: string, who: string, rule: Rule): Result {
    const key = `${bucket}:${who}`
    const windowMs = rule.windowSeconds * 1000
    const current = this.now()
    const recent = (this.hits.get(key)?.times ?? []).filter((time) => current - time < windowMs)

    if (recent.length >= rule.limit) {
      this.hits.set(key, { times: recent, windowMs })
      const retry = Math.ceil((recent[0] + windowMs - current) / 1000)
      return { allowed: false, retryAfterSeconds: Math.max(1, retry) }
    }

    recent.push(current)
    this.hits.set(key, { times: recent, windowMs })
    this.enforceCap()
    return { allowed: true, retryAfterSeconds: 0 }
  }

  /** Descarta lo que ya venció; se llama cada tanto para que la memoria no crezca. */
  sweep(): void {
    const current = this.now()
    for (const [key, entry] of this.hits) {
      const last = entry.times[entry.times.length - 1] ?? 0
      if (current - last >= entry.windowMs) this.hits.delete(key)
    }
  }

  /** Con muchas claves distintas (por ejemplo IPs inventadas) descarta las más viejas para no crecer sin límite. */
  private enforceCap(): void {
    if (this.hits.size <= this.maxKeys) return
    this.sweep()
    for (const key of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break
      this.hits.delete(key)
    }
  }

  size(): number {
    return this.hits.size
  }
}
