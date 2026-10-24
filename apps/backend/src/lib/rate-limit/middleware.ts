import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { clientIp, trustedHopsFromEnv } from "../order-access/ip"
import { hashIp } from "../order-access/limits"
import { type Limits, RateLimiter, parseLimits } from "./limiter"

const limiter = new RateLimiter()
const limits = parseLimits(process.env.RATE_LIMITS)

// Evita que el mapa crezca con IPs que no vuelven.
setInterval(() => limiter.sweep(), 60_000).unref()

/**
 * Límite de solicitudes por ruta e IP (seguridad.md, SEC-17; planning.md, HU-43).
 * Los valores se cambian con `RATE_LIMITS` sin tocar el código. Cada superación
 * queda registrada sin la IP en claro (SEC-70 y SEC-95).
 */
export function rateLimit(bucket: keyof Limits) {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const ip =
      clientIp({
        remoteAddress: req.socket.remoteAddress,
        forwardedFor: req.headers["x-forwarded-for"] as string | undefined,
        trustedHops: trustedHopsFromEnv(process.env.TRUSTED_PROXY_HOPS),
      }) ?? "desconocida"

    const result = limiter.hit(bucket, ip, limits[bucket])
    if (result.allowed) return next()

    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.warn(
      JSON.stringify({
        event: "rate_limited",
        bucket,
        path: req.path.split("/").slice(0, 3).join("/"),
        client: (hashIp(ip) ?? "").slice(0, 12),
      })
    )
    res.setHeader("Retry-After", String(result.retryAfterSeconds))
    res.status(429).json({
      type: "not_allowed",
      code: "RATE_LIMITED",
      message: "Demasiadas solicitudes. Esperá un momento y volvé a intentar.",
    })
  }
}
