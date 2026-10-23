import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { hasDiscountPaymentMismatch } from "./guard"
import { getTransferCode } from "./secret"

/**
 * Rechaza completar un carrito que tiene la promoción de transferencia con un
 * pago que no es del proveedor manual (seguridad.md, SEC-31; planning.md,
 * HU-22). Lee el carrito de nuevo: no confía en lo que traiga el flujo.
 */
export async function validateDiscountPayment(container: MedusaContainer, cartId: string): Promise<void> {
  const secret = await getTransferCode(container)
  if (!secret) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "promotions.code", "payment_collection.payment_sessions.provider_id"],
    filters: { id: cartId },
  })

  const promoCodes = (cart?.promotions ?? []).flatMap((p) => (p?.code ? [p.code] : []))
  const providerIds = (cart?.payment_collection?.payment_sessions ?? []).flatMap((s) =>
    s?.provider_id ? [s.provider_id] : []
  )

  if (hasDiscountPaymentMismatch({ promoCodes, secret, providerIds })) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "El descuento por transferencia solo vale si pagás por transferencia. Volvé a elegir el medio de pago.",
      "DISCOUNT_PAYMENT_MISMATCH"
    )
  }
}
