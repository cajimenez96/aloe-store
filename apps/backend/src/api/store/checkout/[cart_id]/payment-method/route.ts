import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN, MedusaError, PromotionActions } from "@medusajs/framework/utils"
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  deletePaymentSessionsWorkflow,
  updateCartPromotionsWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { z } from "zod"
import { MANUAL_PROVIDER_ID, planPaymentMethod } from "../../../../../lib/transfer-discount/guard"
import { getTransferCode } from "../../../../../lib/transfer-discount/secret"

const bodySchema = z.object({ method: z.enum(["card", "transfer"]) }).strict()

/**
 * Elegir tarjeta o transferencia (arquitectura.md, sección 14.1; planning.md,
 * HU-21). Es el único lugar donde se aplica o se quita la promoción de
 * transferencia, con el código interno que el cliente nunca ve (SEC-31).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Elegí tarjeta o transferencia.")
  }
  const { method } = parsed.data
  const cartId = req.params.cart_id

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const secret = await getTransferCode(req.scope)

  const load = async () => {
    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "completed_at",
        "metadata",
        "subtotal",
        "discount_total",
        "total",
        "promotions.code",
        "payment_collection.id",
        "payment_collection.payment_sessions.id",
        "payment_collection.payment_sessions.provider_id",
        "payment_collection.payment_sessions.status",
      ],
      filters: { id: cartId },
    })
    return cart
  }

  let cart = await load()
  if (!cart || cart.completed_at) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No encontramos tu carrito.")
  }

  if (method === "transfer" && !secret) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "La transferencia no está disponible por ahora.",
      "PAYMENT_PROVIDER_UNAVAILABLE"
    )
  }

  const promoApplied = Boolean(
    secret && (cart.promotions ?? []).some((p) => p?.code?.toLowerCase() === secret.toLowerCase())
  )
  const plan = planPaymentMethod(method, promoApplied)

  // Sin descuento antes de cambiar de proveedor: nunca coexiste con otro medio.
  if (plan === "remove" && secret) {
    await updateCartPromotionsWorkflow(req.scope).run({
      input: { cart_id: cartId, promo_codes: [secret], action: PromotionActions.REMOVE },
    })
  }

  // Cualquier sesión de otro proveedor se descarta al pasar a transferencia.
  if (method === "transfer") {
    const others = (cart.payment_collection?.payment_sessions ?? []).flatMap((s) =>
      s && s.provider_id !== MANUAL_PROVIDER_ID ? [s.id] : []
    )
    if (others.length > 0) {
      await deletePaymentSessionsWorkflow(req.scope).run({ input: { ids: others } })
    }
  }

  if (plan === "apply" && secret) {
    await updateCartPromotionsWorkflow(req.scope).run({
      input: { cart_id: cartId, promo_codes: [secret], action: PromotionActions.ADD },
    })
  }

  if (method === "transfer") {
    cart = await load()
    let collectionId = cart.payment_collection?.id
    if (!collectionId) {
      const { result } = await createPaymentCollectionForCartWorkflow(req.scope).run({
        input: { cart_id: cartId },
      })
      collectionId = result.id
    }
    const hasManual = (cart.payment_collection?.payment_sessions ?? []).some(
      (s) => s?.provider_id === MANUAL_PROVIDER_ID
    )
    if (!hasManual) {
      await createPaymentSessionsWorkflow(req.scope).run({
        input: { payment_collection_id: collectionId, provider_id: MANUAL_PROVIDER_ID },
      })
    }
  }

  // La tarjeta todavía no crea una sesión de pago (HU-24): se recuerda la elección
  // en el carrito, sin pisar el resto de la metadata (por ejemplo el documento).
  await updateCartWorkflow(req.scope).run({
    input: { id: cartId, metadata: { ...(cart.metadata ?? {}), payment_method: method } },
  })

  cart = await load()
  const session = (cart.payment_collection?.payment_sessions ?? []).find(
    (s) => s?.provider_id === MANUAL_PROVIDER_ID
  )

  res.json({
    cart: {
      id: cart.id,
      subtotal: MathBN.convert(cart.subtotal).toNumber(),
      discount_total: MathBN.convert(cart.discount_total).toNumber(),
      total: MathBN.convert(cart.total).toNumber(),
    },
    payment_session: method === "transfer" && session ? { provider_id: session.provider_id, status: session.status } : null,
  })
}
