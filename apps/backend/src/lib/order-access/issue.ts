import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { addTokenHash } from "./hashes"
import { generateToken, hashToken } from "./token"

/**
 * Enlace nuevo al pedido para un email posterior al de la confirmación. Como solo
 * se guarda el hash, cada email emite su propio token y los anteriores siguen
 * valiendo (seguridad.md, SEC-24).
 */
export async function issueOrderToken(container: MedusaContainer, orderId: string): Promise<string | null> {
  return mint(container, orderId, false)
}

/**
 * Entrega un token al cliente que vuelve de pagar con tarjeta, una sola vez por pedido. Si
 * ya se entregó devuelve null: quien repita la consulta no puede ir sumando tokens hasta
 * desplazar el del email (se guardan solo los últimos 5).
 */
export async function claimOrderToken(container: MedusaContainer, orderId: string): Promise<string | null> {
  return mint(container, orderId, true)
}

async function mint(container: MedusaContainer, orderId: string, once: boolean): Promise<string | null> {
  // Leer y escribir la metadata va bajo un bloqueo: llamadas simultáneas no se pisan entre sí.
  return container.resolve(Modules.LOCKING).execute(
    `order-token:${orderId}`,
    async () => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const {
        data: [order],
      } = await query.graph({ entity: "order", fields: ["id", "metadata"], filters: { id: orderId } })
      if (!order) return null
      const metadata = (order.metadata ?? {}) as Record<string, unknown>
      if (once && metadata.access_claimed === true) return null

      const token = generateToken()
      await container.resolve(Modules.ORDER).updateOrders(orderId, {
        metadata: { ...addTokenHash(metadata, hashToken(token)), ...(once ? { access_claimed: true } : {}) },
      })
      return token
    },
    { timeout: 15 }
  )
}

/** Enlace del email al pedido, con un token nuevo. */
export async function issueOrderLink(container: MedusaContainer, orderId: string): Promise<string | null> {
  const token = await issueOrderToken(container, orderId)
  if (!token) return null
  const storefront = (process.env.STOREFRONT_URL ?? "http://localhost:3000").replace(/\/+$/, "")
  return `${storefront}/pedido/${orderId}/acceso?token=${token}`
}
