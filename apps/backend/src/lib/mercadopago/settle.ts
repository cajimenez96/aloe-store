import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules, PaymentActions } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { logEvent } from "../logging/log"
import { notifyPaymentRefunded } from "../notifications/order-emails"
import { MercadoPagoClient, MpApiError, MpUnavailableError } from "./client"
import { MP_PROVIDER_ID, readMpConfig } from "./config"
import { decideSettlement, isDuplicateApproval, isOurReference, pickPayment } from "./decide"
import { mapStatus, type MpPayment } from "./payment"

export type SettleOutcome =
  | { action: "ignored" }
  | { action: "unavailable" }
  | { action: "noop" | "pending" | "rejected" | "refunded" | "mismatch"; orderId?: string }
  | { action: "captured"; orderId: string }
  | { action: "refunded_no_stock" }
  | { action: "orphan_refunded" }
  | { action: "duplicate_refunded"; orderId?: string }
  | { action: "refund_failed" }

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
 * Todo corre bajo un bloqueo por sesión y vuelve a consultar el pago dentro de él: señales
 * simultáneas se ordenan y la segunda ve el resultado de la primera, así que no hay doble
 * captura ni doble reembolso. Con la opción A de arquitectura.md, sección 10.2, el pedido
 * se crea cuando llega el pago aprobado; si no se puede crear, el pago se reembolsa.
 */
export async function settleSession(
  container: MedusaContainer,
  sessionId: string,
  hint: { payment?: MpPayment; requestId?: string } = {}
): Promise<SettleOutcome> {
  return container.resolve(Modules.LOCKING).execute(
    `mp-settle:${sessionId}`,
    () => settleLocked(container, sessionId, hint),
    { timeout: 30 }
  )
}

async function refundOnce(
  container: MedusaContainer,
  client: MercadoPagoClient,
  paymentId: string,
  key: string,
  event: string,
  fields: Record<string, unknown>,
  requestId?: string
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await client.refund(paymentId, undefined, key)
    logEvent(logger, "warn", event, fields, requestId)
    return true
  } catch (error) {
    // Si el reembolso falla, el dinero queda cobrado: se registra como error para que alguien lo resuelva.
    logEvent(logger, "error", "payment_refund_failed", { ...fields, reason: error instanceof MpApiError ? `HTTP ${error.status}` : "sin respuesta" }, requestId)
    return false
  }
}

async function settleLocked(
  container: MedusaContainer,
  sessionId: string,
  hint: { payment?: MpPayment; requestId?: string }
): Promise<SettleOutcome> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const client = mpClientFromEnv()

  // Siempre se vuelve a pedir el pago dentro del bloqueo: la copia de la notificación puede estar vieja.
  let payments: MpPayment[]
  try {
    payments = hint.payment ? [await client.getPayment(String(hint.payment.id))] : await client.searchPayments(sessionId)
  } catch (error) {
    if (error instanceof MpUnavailableError) return { action: "unavailable" }
    throw error
  }

  const {
    data: [session],
  } = await query.graph({
    entity: "payment_session",
    fields: ["id", "amount", "currency_code", "status", "provider_id", "payment_collection_id"],
    filters: { id: sessionId },
  })

  // La sesión ya no existe (Medusa las descarta cuando el carrito cambia después de crear la
  // preferencia) pero el cliente pagó igual: se devuelve el dinero y queda registrado.
  if (!session) {
    const orphan = payments.find((payment) => payment.status === "approved" && isOurReference(payment.external_reference) && payment.external_reference === sessionId)
    if (!orphan) return { action: "ignored" }
    const ok = await refundOnce(container, client, String(orphan.id), `refund-orphan-${sessionId}`, "payment_orphan_refunded", { session_id: sessionId, reason: "la sesión de pago ya no existe" }, hint.requestId)
    return ok ? { action: "orphan_refunded" } : { action: "refund_failed" }
  }
  if (session.provider_id !== MP_PROVIDER_ID) return { action: "ignored" }

  const {
    data: [link],
  } = await query.graph({
    entity: "cart_payment_collection",
    fields: ["cart_id"],
    filters: { payment_collection_id: session.payment_collection_id },
  })
  const cartId = link?.cart_id as string | undefined
  const existingOrder = cartId ? await orderOfCart(container, cartId) : null

  const amount = MathBN.convert(session.amount as never).toNumber()
  const expected = { amount, currency: String(session.currency_code), reference: session.id }
  const payment = pickPayment(payments, expected)

  // Ya hay un pedido: un segundo pago aprobado para el mismo carrito es un cobro doble.
  if (existingOrder && payment && payment.status === "approved") {
    const {
      data: [captured],
    } = await query.graph({ entity: "payment", fields: ["id", "data"], filters: { payment_session_id: session.id } })
    const capturedId = (captured?.data as { mp_payment_id?: string } | null | undefined)?.mp_payment_id ?? null
    if (isDuplicateApproval({ payment, capturedPaymentId: capturedId })) {
      const ok = await refundOnce(container, client, String(payment.id), `refund-duplicate-${payment.id}`, "payment_duplicate_refunded", { session_id: session.id, order_id: existingOrder }, hint.requestId)
      return ok ? { action: "duplicate_refunded", orderId: existingOrder } : { action: "refund_failed" }
    }
  }

  const decision = decideSettlement({
    session: { id: session.id, amount, currency: expected.currency, done: Boolean(existingOrder) },
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
      const ok = await refundOnce(container, client, decision.paymentId, `refund-nostock-${session.id}`, "payment_refunded_no_order", { session_id: session.id, reason: "no se pudo crear el pedido" }, hint.requestId)
      if (!ok) return { action: "refund_failed" }
      if (cartId) await notifyPaymentRefunded(container, cartId, amount)
      return { action: "refunded_no_stock" }
    }
    case "mismatch":
      logEvent(logger, "error", "PAYMENT_AMOUNT_MISMATCH", { session_id: session.id, payment_id: String(payment?.id ?? "") }, hint.requestId)
      return { action: "mismatch" }
    default:
      // Un pago devuelto antes de crear el pedido cuenta como devuelto, no como pendiente.
      if (payment && mapStatus(payment.status) === "refunded" && !existingOrder) return { action: "refunded" }
      return { action: decision.action, ...(existingOrder ? { orderId: existingOrder } : {}) }
  }
}
