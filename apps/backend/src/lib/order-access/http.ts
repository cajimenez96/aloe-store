import type { MedusaResponse } from "@medusajs/framework/http"

/**
 * Respuesta única para cualquier acceso inválido al pedido: token ausente,
 * incorrecto, vencido o pedido inexistente. No revela si el pedido existe
 * (seguridad.md, SEC-24).
 */
export function orderAccessDenied(res: MedusaResponse) {
  res.status(404).json({
    type: "not_found",
    code: "ORDER_ACCESS_DENIED",
    message: "No encontramos ese pedido. Entrá con el enlace que te enviamos por email.",
  })
}

/** Error con el estado HTTP y el `code` del catálogo de arquitectura.md, sección 15. */
export function fail(res: MedusaResponse, status: number, code: string, message: string) {
  res.status(status).json({ type: "not_allowed", code, message })
}
