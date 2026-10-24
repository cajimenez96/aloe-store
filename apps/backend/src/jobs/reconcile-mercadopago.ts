import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logEvent } from "../lib/logging/log"
import { MP_PROVIDER_ID, readMpConfig } from "../lib/mercadopago/config"
import { settleSession } from "../lib/mercadopago/settle"

const minutes = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1440 ? parsed : fallback
}

/**
 * Conciliación de pagos con tarjeta (planning.md, HU-26): revisa los pagos iniciados hace
 * más de `MP_RECONCILE_AFTER_MINUTES` (15 por defecto) que siguen sin resolverse,
 * consultando a la API de Mercado Pago. Cubre los webhooks que no llegan y, sin URL
 * pública, es el mecanismo que confirma los pagos de sandbox en local.
 */
export default async function reconcileMercadoPago(container: MedusaContainer) {
  if (!readMpConfig(process.env).enabled) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const after = minutes(process.env.MP_RECONCILE_AFTER_MINUTES, 15)
  const cutoff = new Date(Date.now() - after * 60_000)
  const oldest = new Date(Date.now() - 7 * 24 * 3_600_000)

  const { data: sessions } = await query.graph({
    entity: "payment_session",
    fields: ["id", "status", "created_at"],
    filters: { provider_id: MP_PROVIDER_ID, status: "pending", created_at: { $lte: cutoff, $gte: oldest } } as never,
  })

  let changed = 0
  let mismatches = 0
  for (const session of sessions) {
    try {
      const outcome = await settleSession(container, session.id)
      if (outcome.action === "captured" || outcome.action === "refunded_no_stock") changed++
      if (outcome.action === "mismatch") mismatches++
    } catch (error) {
      logEvent(logger, "error", "mp_reconcile_failed", { session_id: session.id, reason: error instanceof Error ? error.message : "desconocido" })
    }
  }
  logEvent(logger, "info", "mp_reconcile", { reviewed: sessions.length, changed, mismatches })
}

export const config = {
  name: "reconcile-mercadopago",
  schedule: `*/${Math.max(1, minutes(process.env.MP_RECONCILE_EVERY_MINUTES, 5))} * * * *`,
}
