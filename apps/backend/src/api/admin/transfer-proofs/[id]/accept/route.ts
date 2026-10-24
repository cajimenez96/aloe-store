import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"
import { TRANSFER_PROOF_MODULE } from "../../../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../../../modules/transfer-proof/service"
import { notifyOrderPaid } from "../../../../../lib/notifications/order-emails"
import { canReview } from "../../../../../lib/transfer-proofs/review"

/**
 * Aceptar un comprobante (arquitectura.md, sección 14.4; planning.md, HU-29):
 * captura el pago con el flujo nativo y el pedido queda pagado.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const proofs = req.scope.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
  const [proof] = await proofs.listTransferProofs({ id: req.params.id })
  if (!proof) return res.status(404).json({ type: "not_found", message: "No encontramos el comprobante." })
  if (!canReview(proof.status)) {
    return res.status(409).json({
      type: "not_allowed",
      code: "TRANSFER_PROOF_NOT_REVIEWABLE",
      message: "Este comprobante ya fue revisado.",
    })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.payments.id", "payment_collections.payments.captured_at"],
    filters: { id: proof.order_id },
  })
  const payment = (order?.payment_collections ?? []).flatMap((c) => c?.payments ?? []).find((p) => p && !p.captured_at)
  if (!payment) {
    return res.status(409).json({
      type: "not_allowed",
      code: "ORDER_ALREADY_PAID",
      message: "El pedido no tiene un pago pendiente de captura.",
    })
  }

  const note = typeof (req.body as { note?: unknown })?.note === "string" ? (req.body as { note: string }).note.slice(0, 300) : null

  await capturePaymentWorkflow(req.scope).run({
    input: { payment_id: payment.id, captured_by: req.auth_context?.actor_id },
  })
  await proofs.updateTransferProofs({
    id: proof.id,
    status: "accepted",
    review_note: note,
    reviewed_by: req.auth_context?.actor_id ?? null,
    reviewed_at: new Date(),
  })

  await notifyOrderPaid(req.scope, proof.order_id)
  res.json({ transfer_proof: { id: proof.id, status: "accepted" } })
}
