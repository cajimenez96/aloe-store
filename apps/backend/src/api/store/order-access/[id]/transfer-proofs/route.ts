import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createHash } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { fail, orderAccessDenied } from "../../../../../lib/order-access/http"
import { notifyAdminProofReceived } from "../../../../../lib/notifications/order-emails"
import { authorizeOrder } from "../../../../../lib/order-access/authorize"
import { TRANSFER_PROOF_MODULE } from "../../../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../../../modules/transfer-proof/service"
import { uploadBlocker } from "../../../../../lib/transfer-proofs/rules"
import { saveProof } from "../../../../../lib/transfer-proofs/storage"
import { validateProofFile } from "../../../../../lib/transfer-proofs/validate"

const BLOCKERS = {
  ORDER_EXPIRED: [409, "El pedido venció. Hacé un pedido nuevo."],
  TRANSFER_PROOF_PENDING: [409, "Ya hay un comprobante en revisión. Esperá la respuesta del comercio."],
  ORDER_ALREADY_PAID: [409, "Este pedido ya está pagado."],
  TOO_MANY_UPLOADS: [429, "Subiste demasiados comprobantes en poco tiempo. Probá más tarde."],
} as const

/** Estado del último comprobante y el motivo si fue rechazado (planning.md, HU-28). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const order = await authorizeOrder(req.scope, req.params.id, req.headers["x-order-token"])
  if (!order) return orderAccessDenied(res)

  const proofs = req.scope.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
  const [latest] = await proofs.listTransferProofs(
    { order_id: order.id },
    { order: { created_at: "DESC" }, take: 1 }
  )

  res.json({
    transfer_proof: latest
      ? {
          id: latest.id,
          status: latest.status,
          rejection_reason: latest.status === "rejected" ? latest.rejection_reason : null,
          created_at: latest.created_at,
        }
      : null,
  })
}

/** Subir un comprobante (arquitectura.md, sección 14.2; planning.md, HU-28). */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const order = await authorizeOrder(req.scope, req.params.id, req.headers["x-order-token"])
  if (!order) return orderAccessDenied(res)

  const file = (req as unknown as { file?: { buffer: Buffer } }).file
  if (!file) {
    return fail(res, 415, "TRANSFER_PROOF_FORMAT_INVALID", "Subí un JPG, PNG o PDF.")
  }
  const checked = validateProofFile(file.buffer)
  if (!checked.ok) {
    return fail(
      res,
      checked.code === "TRANSFER_PROOF_TOO_LARGE" ? 413 : 415,
      checked.code,
      checked.code === "TRANSFER_PROOF_TOO_LARGE"
        ? "El archivo supera los 5 MB. Comprimí la imagen o subí un PDF."
        : "Formato no permitido. Subí un JPG, PNG o PDF."
    )
  }

  const proofs = req.scope.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
  const dueAt = typeof order.metadata.transfer_due_at === "string" ? new Date(order.metadata.transfer_due_at) : null

  // Verificar las reglas y crear el comprobante van juntos bajo un bloqueo por pedido:
  // sin él, subidas en paralelo pasan todas el control (un solo comprobante en revisión
  // y 5 por hora) y llenan el disco.
  type Outcome =
    | { ok: true; proof: { id: string; status: string; created_at: unknown } }
    | { ok: false; status: number; code: string; message: string }

  const outcome: Outcome = await req.scope.resolve(Modules.LOCKING).execute(
    `proof-upload:${order.id}`,
    async (): Promise<Outcome> => {
      const existing = await proofs.listTransferProofs({ order_id: order.id })
      const blocker = uploadBlocker({
        order: { status: order.status, dueAt },
        proofs: existing.map((proof) => ({ status: proof.status, createdAt: new Date(proof.created_at) })),
      })
      if (blocker) {
        const [status, message] = BLOCKERS[blocker]
        return { ok: false, status, code: blocker, message }
      }

      const key = await saveProof(file.buffer)
      const proof = await proofs.createTransferProofs({
        order_id: order.id,
        status: "pending_review",
        storage_key: key,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
        mime: checked.mime,
        size: file.buffer.length,
      })
      return { ok: true, proof: { id: proof.id, status: proof.status, created_at: proof.created_at } }
    },
    { timeout: 15 }
  )

  if (!outcome.ok) return fail(res, outcome.status, outcome.code, outcome.message)

  await notifyAdminProofReceived(req.scope, order.displayId)
  res.status(201).json({ transfer_proof: outcome.proof })
}
