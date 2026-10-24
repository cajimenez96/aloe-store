import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { issueOrderToken } from "../../../../../lib/order-access/issue"
import { MP_PROVIDER_ID } from "../../../../../lib/mercadopago/config"
import { orderOfCart, settleSession } from "../../../../../lib/mercadopago/settle"

/**
 * Estado del pago con tarjeta al volver de Mercado Pago (planning.md, HU-24; seguridad.md,
 * SEC-33). Nunca confía en los parámetros de la URL de regreso: concilia consultando a
 * Mercado Pago. Si el pedido ya existe, entrega un token nuevo para entrar a verlo; el
 * identificador del carrito, que solo tiene el navegador del comprador, hace de credencial.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartId = req.params.cart_id

  const existing = await orderOfCart(req.scope, cartId)
  if (existing) {
    const token = await issueOrderToken(req.scope, existing)
    return res.json({ status: "approved", order_id: existing, token })
  }

  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "payment_collection.payment_sessions.id", "payment_collection.payment_sessions.provider_id"],
    filters: { id: cartId },
  })
  const session = (cart?.payment_collection?.payment_sessions ?? []).find((s) => s?.provider_id === MP_PROVIDER_ID)
  if (!cart || !session) return res.status(404).json({ type: "not_found", message: "No encontramos un pago con tarjeta para este carrito." })

  const outcome = await settleSession(req.scope, session.id, { requestId: req.requestId })
  switch (outcome.action) {
    case "captured": {
      const token = await issueOrderToken(req.scope, outcome.orderId)
      return res.json({ status: "approved", order_id: outcome.orderId, token })
    }
    case "rejected":
      return res.json({ status: "rejected" })
    case "refunded_no_stock":
      return res.json({ status: "refunded", code: "STOCK_INSUFFICIENT" })
    case "mismatch":
      return res.json({ status: "error", code: "PAYMENT_AMOUNT_MISMATCH" })
    case "unavailable":
      return res.status(503).json({ type: "unexpected_state", code: "PAYMENT_PROVIDER_UNAVAILABLE", message: "No pudimos consultar a Mercado Pago. Probá de nuevo en un momento." })
    default:
      return res.json({ status: "pending" })
  }
}
