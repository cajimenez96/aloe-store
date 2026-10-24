import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { addTokenHash } from "./hashes"
import { generateToken, hashToken } from "./token"

/**
 * Enlace nuevo al pedido para un email posterior al de la confirmación. Como solo
 * se guarda el hash, cada email emite su propio token y los anteriores siguen
 * valiendo (seguridad.md, SEC-24).
 */
export async function issueOrderLink(container: MedusaContainer, orderId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: orderId } })
  if (!order) return null

  const token = generateToken()
  await container.resolve(Modules.ORDER).updateOrders(orderId, {
    metadata: addTokenHash((order.metadata ?? {}) as Record<string, unknown>, hashToken(token)),
  })

  const storefront = (process.env.STOREFRONT_URL ?? "http://localhost:3000").replace(/\/+$/, "")
  return `${storefront}/pedido/${orderId}/acceso?token=${token}`
}
