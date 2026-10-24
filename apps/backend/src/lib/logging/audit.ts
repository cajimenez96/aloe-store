import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logEvent } from "./log"
import { maskEmail } from "./redact"

type AuthedRequest = MedusaRequest & { auth_context?: { actor_id?: string } }

/**
 * Registra una acción sensible del panel cuando termina bien, con el usuario que la
 * hizo (seguridad.md, SEC-95: capturas, reembolsos y cancelaciones). El objetivo es
 * el id que va en la ruta; no se registra el cuerpo.
 */
export function auditAdminAction(event: string) {
  return (req: AuthedRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    res.on("finish", () => {
      if (res.statusCode >= 400) return
      logEvent(
        req.scope.resolve(ContainerRegistrationKeys.LOGGER),
        "info",
        event,
        { actor_id: req.auth_context?.actor_id ?? "desconocido", target_id: req.params?.id ?? "", status: res.statusCode },
        req.requestId
      )
    })
    next()
  }
}

/** Logins del panel, exitosos y fallidos (SEC-95). El email se registra enmascarado. */
export function auditLogin(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  res.on("finish", () => {
    const ok = res.statusCode < 400
    const email = (req.body as { email?: unknown } | undefined)?.email
    logEvent(
      req.scope.resolve(ContainerRegistrationKeys.LOGGER),
      ok ? "info" : "warn",
      ok ? "login_success" : "login_failed",
      { who: maskEmail(email), status: res.statusCode },
      req.requestId
    )
  })
  next()
}
