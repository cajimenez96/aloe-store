import { logEvent } from "../logging/log"
import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { decide, resolveRole } from "./policy"

const DENIED_BODY = {
  type: "not_allowed",
  code: "ROLE_NOT_ALLOWED",
  message:
    "Tu rol no tiene permiso para esta acción. Pedile el permiso al administrador.",
}

const STORE_ROUTE = /^\/admin\/stores(\/|$)/i

/** Quita `metadata` de las tiendas de la respuesta: ahí viven el CBU y el código de la promoción. */
function redactStoreMetadata(res: MedusaResponse) {
  const send = res.json.bind(res)
  res.json = ((body: unknown) => {
    const strip = (store: unknown) => {
      if (store && typeof store === "object") {
        delete (store as Record<string, unknown>).metadata
      }
    }
    if (body && typeof body === "object") {
      const payload = body as { store?: unknown; stores?: unknown }
      strip(payload.store)
      if (Array.isArray(payload.stores)) {
        payload.stores.forEach(strip)
      }
    }
    return send(body as never)
  }) as typeof res.json
}

/**
 * Guard de /admin/* (seguridad.md, SEC-21). Va después de la autenticación de
 * Medusa: solo actúa sobre usuarios del panel ya autenticados. Una solicitud sin
 * autenticar la rechaza la propia autenticación de Medusa.
 *
 * Falla cerrado: si no se puede leer el usuario, se deniega.
 */
export async function enforceRole(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const auth = (req as AuthenticatedMedusaRequest).auth_context
  if (!auth?.actor_id || auth.actor_type !== "user") {
    return next()
  }

  const path = (req.originalUrl ?? req.url ?? "").split("?")[0]
  let role = resolveRole(undefined)
  let allowed = false

  try {
    const users = req.scope.resolve(Modules.USER)
    const user = await users.retrieveUser(auth.actor_id, {
      select: ["id", "metadata"],
    })
    role = resolveRole(user.metadata)
    allowed = decide(role, req.method, req.originalUrl ?? req.url ?? "")
  } catch {
    // Sin poder confirmar el rol, se trata como vendedor y se deniega abajo.
  }

  if (allowed) {
    if (role === "vendedor" && STORE_ROUTE.test(path)) {
      redactStoreMetadata(res)
    }
    return next()
  }

  // SEC-95: acceso rechazado por permisos. Sin query ni datos personales.
  logEvent(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    "warn",
    "role_denied",
    { user_id: auth.actor_id, role, method: req.method, path },
    req.requestId
  )
  res.status(403).json(DENIED_BODY)
}
