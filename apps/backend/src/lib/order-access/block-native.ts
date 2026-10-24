import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { orderAccessDenied } from "./http"

/**
 * Cierra las rutas nativas de pedidos de la tienda (seguridad.md, SEC-24): el
 * cliente invitado entra solo por `/store/order-access/:id` con su token, y los
 * pedidos se confirman solo por `/store/checkout/:cart_id/complete`.
 */
export function blockNativeOrderRoutes(_req: MedusaRequest, res: MedusaResponse, _next: MedusaNextFunction) {
  orderAccessDenied(res)
}
