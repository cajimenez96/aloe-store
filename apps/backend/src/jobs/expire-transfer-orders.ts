import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { TRANSFER_PROOF_MODULE } from "../modules/transfer-proof"
import type TransferProofModuleService from "../modules/transfer-proof/service"
import { logEvent } from "../lib/logging/log"
import { shouldExpire } from "../lib/transfer-proofs/expiry"

/**
 * Cancela los pedidos por transferencia vencidos (planning.md, HU-30). Usa la
 * cancelación nativa, que libera las reservas de stock, y deja el motivo en la
 * metadata para que el email diga que fue por vencimiento.
 */
export default async function expireTransferOrders(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const proofs = container.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "status", "metadata"],
    filters: { status: "pending" },
  })

  for (const order of orders) {
    const metadata = (order.metadata ?? {}) as Record<string, unknown>
    if (metadata.payment_method !== "transfer") continue
    const dueAt = typeof metadata.transfer_due_at === "string" ? new Date(metadata.transfer_due_at) : null
    if (!dueAt || dueAt.getTime() >= Date.now()) continue

    const list = await proofs.listTransferProofs({ order_id: order.id })
    if (!shouldExpire({ status: order.status, method: "transfer", dueAt, proofs: list })) continue

    try {
      await container.resolve(Modules.ORDER).updateOrders(order.id, {
        metadata: { ...metadata, cancel_reason: "expired" },
      })
      await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })
      logEvent(logger, "info", "order_auto_canceled", { order_id: order.id, reason: "expired" })
    } catch (error) {
      logEvent(logger, "error", "order_auto_cancel_failed", {
        order_id: order.id,
        reason: error instanceof Error ? error.message : "desconocido",
      })
    }
  }
}

export const config = {
  name: "expire-transfer-orders",
  schedule: "*/10 * * * *",
}
