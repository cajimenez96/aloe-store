import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MathBN } from "@medusajs/framework/utils"
import { getOrdersListWorkflow } from "@medusajs/medusa/core-flows"
import { pageOrders } from "../../../lib/orders/list"

const PAGE_LIMIT = 25
// Medusa calcula el estado de pago al leer cada pedido, así que el filtro se aplica sobre
// los más recientes: alcanza para una tienda chica y evita leer toda la historia.
const WINDOW = 500
const ID = /^[A-Za-z0-9_]{1,100}$/

/**
 * Pedidos con filtro por canal y por estado de pago, que el listado nativo de Medusa
 * 2.22 no tiene (planning.md, HU-32). Es una consulta de admin.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const channel = typeof req.query.sales_channel_id === "string" && ID.test(req.query.sales_channel_id) ? req.query.sales_channel_id : null
  const group = typeof req.query.payment_group === "string" ? req.query.payment_group : ""
  const offset = Math.max(0, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0)

  // Es el mismo flujo que usa el listado nativo: calcula el estado de pago de cada pedido.
  const { result } = await getOrdersListWorkflow(req.scope).run({
    input: {
      fields: [
        "id",
        "display_id",
        "created_at",
        "email",
        "total",
        "currency_code",
        "payment_status",
        "fulfillment_status",
        "status",
        "sales_channel.name",
      ],
      variables: {
        filters: { is_draft_order: false, ...(channel ? { sales_channel_id: channel } : {}) },
        skip: 0,
        take: WINDOW,
        order: { created_at: "DESC" },
      },
    },
  })
  const data = Array.isArray(result) ? result : result.rows

  const page = pageOrders({ orders: data as { payment_status?: string | null }[], group, offset, limit: PAGE_LIMIT })
  res.json({
    count: page.count,
    window: WINDOW,
    orders: (page.orders as Record<string, any>[]).map((order) => ({ ...order, total: MathBN.convert(order.total).toNumber() })),
  })
}
