import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isTokenExpired, verifyToken } from "./token"

export type AuthorizedOrder = {
  id: string
  status: string
  email: string | null
  displayId: number
  metadata: Record<string, unknown>
}

/**
 * Pedido al que da acceso el token, o null si no corresponde por cualquier motivo
 * (token ausente o incorrecto, pedido inexistente o vencido). El llamador responde
 * siempre igual ante null, sin decir cuál fue el motivo (seguridad.md, SEC-24).
 */
export async function authorizeOrder(
  container: MedusaContainer,
  orderId: string,
  header: unknown
): Promise<AuthorizedOrder | null> {
  const token = typeof header === "string" ? header : ""
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "email", "updated_at", "metadata"],
    filters: { id: orderId },
  })

  const metadata = (order?.metadata ?? {}) as Record<string, unknown>
  const valid = verifyToken(token, metadata.access_token_hash as string | undefined)
  if (!order || !valid) return null
  if (isTokenExpired({ status: order.status, updatedAt: new Date(order.updated_at as string) })) return null

  return {
    id: order.id,
    status: order.status,
    email: (order.email as string | null) ?? null,
    displayId: Number(order.display_id),
    metadata,
  }
}
