import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, PaymentActions } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { logEvent } from "../logging/log"
import { notifyPaymentRefunded } from "../notifications/order-emails"
import { MercadoPagoClient, MpUnavailableError } from "./client"
import { MP_PROVIDER_ID, readMpConfig } from "./config"
import { decideSettlement, pickPayment } from "./decide"
import type { MpPayment } from "./payment"

export type SettleOutcome =
  | { action: "ignored" }
  | { action: "unavailable" }
  | { action: "noop" | "pending" | "rejected" | "refunded" | "mismatch"; orderId?: string }
  | { action: "captured"; orderId: string }
  | { action: "refunded_no_stock" }

export function mpClientFromEnv(env: Record<string, string | undefined> = process.env): MercadoPagoClient {
  const config = readMpConfig(env)
  return new MercadoPagoClient({ accessToken: config.accessToken, baseUrl: config.apiBase })
}

/** Id del pedido creado a partir de un carrito, si ya existe. */
export async function orderOfCart(container: MedusaContainer, cartId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [link],
  } = await query.graph({ entity: "order_cart", fields: ["order_id"], filters: { cart_id: cartId } })
  return (link?.order_id as string | undefined) ?? null
}

/**
 * Concilia una sesión de pago de Mercado Pago (planning.md, HU-24, HU-25 y HU-26). La
 * usan el webhook, el job de conciliación y la consulta de regreso del cliente, así que
 * el comportamiento es el mismo venga de donde venga la señal: el estado sale de la API
 * de Mercado Pago, se verifican monto, moneda y referencia, y repetir la señal no duplica
 * nada (seguridad.md, SEC-32 y SEC-33).
 *
 * Con la opción A de arquitectura.md, sección 10.2, el pedido se crea cuando llega el pago
 * aprobado. Si en ese momento ya no hay stock, el pago se reembolsa y se avisa al cliente.
 */
export async function settleSession(
  container: MedusaContainer,
  sessionId: string,
  hint: { payment?: MpPayment; requestId?: string } = {}
): Promise<SettleOutcome> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [session],
  } = await query.graph({
    entity: "payment_session",
    fields: ["id", "amount", "currency_code", "status", "provider_id", "payment_collection_id"],
    filters: { id: sessionId },
  })
  if (!session || session.provider_id !== MP_PROVIDER_ID) return { action: "ignored" }

  const {
    data: [link],
  } = await query.graph({
    entity: "cart_payment_collection",
    fields: ["cart_id"],
    filters: { payment_collection_id: session.payment_collection_id },
  })
  const cartId = link?.cart_id as string | undefined
  const existingOrder = cartId ? await orderOfCart(container, cartId) : null

  const client = mpClientFromEnv()
  let payment: MpPayment | null
  try {
    payment = hint.payment ?? pickPayment(await client.searchPayments(session.id))
  } catch (error) {
    if (error instanceof MpUnavailableError) return { action: "unavailable" }
    throw error
  }

  const amount = MathBN.convert(session.amount as never).toNumber()
  const decision = decideSettlement({
    session: { id: session.id, amount, currency: String(session.currency_code), done: Boolean(existingOrder) },
    payment,
  })

  switch (decision.action) {
    case "capture": {
      await processPaymentWorkflow(container).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount as never } },
      })
      const orderId = cartId ? await orderOfCart(container, cartId) : null
      if (orderId) {
        logEvent(logger, "info", "payment_settled", { session_id: session.id, order_id: orderId, via: "mercadopago" }, hint.requestId)
        return { action: "captured", orderId }
      }
      // Se pagó, pero el pedido no se pudo crear (por ejemplo, se agotó el stock): se devuelve el dinero.
      await client.refund(decision.paymentId, undefined, `refund-nostock-${session.id}`)
      logEvent(logger, "warn", "payment_refunded_no_order", { session_id: session.id, reason: "no se pudo crear el pedido" }, hint.requestId)
      if (cartId) await notifyPaymentRefunded(container, cartId, amount)
      return { action: "refunded_no_stock" }
    }
    case "mismatch":
      logEvent(logger, "error", "PAYMENT_AMOUNT_MISMATCH", { session_id: session.id, payment_id: String(payment?.id ?? "") }, hint.requestId)
      return { action: "mismatch" }
    default:
      return { action: decision.action, ...(existingOrder ? { orderId: existingOrder } : {}) }
  }
}
