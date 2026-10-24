import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TRANSFER_PROOF_MODULE } from "../../../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../../../modules/transfer-proof/service"
import { notifyProofRejected } from "../../../../../lib/notifications/order-emails"
import { canReview, validateRejectionReason } from "../../../../../lib/transfer-proofs/review"

/**
 * Rechazar un comprobante con un motivo de 10 a 300 caracteres que ve el cliente
 * (arquitectura.md, sección 14.3; planning.md, HU-29). El pedido sigue pendiente.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const reason = validateRejectionReason((req.body as { reason?: unknown } | undefined)?.reason)
  if (!reason.ok) {
    return res.status(422).json({
      type: "invalid_data",
      code: "REJECTION_REASON_REQUIRED",
      message: "Escribí un motivo de 10 a 300 caracteres.",
    })
  }

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

  await proofs.updateTransferProofs({
    id: proof.id,
    status: "rejected",
    rejection_reason: reason.reason,
    reviewed_by: req.auth_context?.actor_id ?? null,
    reviewed_at: new Date(),
  })

  await notifyProofRejected(req.scope, proof.order_id, reason.reason)
  res.json({ transfer_proof: { id: proof.id, status: "rejected" } })
}
