import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logEvent } from "../../../lib/logging/log"
import { MpApiError, MpUnavailableError } from "../../../lib/mercadopago/client"
import { readMpConfig } from "../../../lib/mercadopago/config"
import { mpClientFromEnv, settleSession } from "../../../lib/mercadopago/settle"
import { verifyWebhookSignature } from "../../../lib/mercadopago/signature"

/**
 * Notificaciones de Mercado Pago (planning.md, HU-25; seguridad.md, SEC-32). Primero se
 * valida la firma con HMAC SHA256 y una ventana de tiempo; una firma inválida responde
 * 401 y queda registrada. La notificación solo avisa que hay algo que mirar: el estado,
 * el monto, la moneda y la referencia salen de la consulta a la API.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const config = readMpConfig(process.env)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  if (!config.enabled) return res.status(404).json({ type: "not_found", message: "Mercado Pago no está configurado." })

  const body = (req.body ?? {}) as { type?: string; data?: { id?: unknown } }
  // Mercado Pago firma el `data.id` que viaja en la URL; el del cuerpo es el respaldo.
  const queryId = req.query["data.id"]
  const dataId = typeof queryId === "string" ? queryId : String(body.data?.id ?? "")
  const requestId = String(req.headers["x-request-id"] ?? "")

  const signature = verifyWebhookSignature({
    secret: config.webhookSecret,
    signatureHeader: req.headers["x-signature"] as string | undefined,
    dataId,
    requestId,
  })
  if (!signature.ok) {
    logEvent(logger, "warn", "webhook_rejected", { reason: signature.reason, provider: "mercadopago" }, req.requestId)
    return res.status(401).json({ type: "unauthorized", code: "WEBHOOK_SIGNATURE_INVALID", message: "Firma inválida." })
  }

  if (body.type && body.type !== "payment") return res.status(200).json({ received: true, ignored: true })
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(dataId)) return res.status(200).json({ received: true, ignored: true })

  try {
    const payment = await mpClientFromEnv().getPayment(dataId)
    const sessionId = payment.external_reference
    if (!sessionId) return res.status(200).json({ received: true, ignored: true })
    const outcome = await settleSession(req.scope, sessionId, { payment, requestId: req.requestId })
    return res.status(200).json({ received: true, action: outcome.action })
  } catch (error) {
    if (error instanceof MpUnavailableError) {
      // Mercado Pago reintenta ante un 5xx.
      return res.status(503).json({ type: "unexpected_state", code: "PAYMENT_PROVIDER_UNAVAILABLE", message: "Reintentá más tarde." })
    }
    if (error instanceof MpApiError) {
      logEvent(logger, "warn", "webhook_payment_lookup_failed", { status: error.status }, req.requestId)
      return res.status(200).json({ received: true, ignored: true })
    }
    throw error
  }
}
