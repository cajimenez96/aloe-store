import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { TRANSFER_PROOF_MODULE } from "../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../modules/transfer-proof/service"
import { proofSecret } from "../../../lib/transfer-proofs/secret"
import { signProofLink } from "../../../lib/transfer-proofs/signed-link"

const STATUSES = ["pending_review", "accepted", "rejected"]
const ORDER_ID = /^[A-Za-z0-9_]{1,100}$/

/**
 * Cola de comprobantes para el panel, del más antiguo al más nuevo (planning.md,
 * HU-29). Cada uno trae un enlace firmado de 15 minutos y se marca si el mismo
 * archivo ya se usó en otro pedido.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // `status=all` y `order_id` sirven al bloque del detalle del pedido (HU-32): todos los comprobantes de un pedido.
  const orderId = typeof req.query.order_id === "string" && ORDER_ID.test(req.query.order_id) ? req.query.order_id : null
  const status =
    req.query.status === "all" && orderId
      ? null
      : typeof req.query.status === "string" && STATUSES.includes(req.query.status)
        ? req.query.status
        : "pending_review"
  const proofs = req.scope.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const filters = { ...(status ? { status } : {}), ...(orderId ? { order_id: orderId } : {}) }
  const list = await proofs.listTransferProofs(filters as never, { order: { created_at: "ASC" }, take: 100 })

  const orderIds = [...new Set(list.map((proof) => proof.order_id))]
  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: ["id", "display_id", "email", "total", "currency_code", "status"],
        filters: { id: orderIds },
      })
    : { data: [] }
  const byId = new Map(orders.map((order) => [order.id, order]))

  const hashes = [...new Set(list.map((proof) => proof.sha256))]
  const sameHash = hashes.length ? await proofs.listTransferProofs({ sha256: hashes }) : []

  res.json({
    transfer_proofs: list.map((proof) => {
      const order = byId.get(proof.order_id)
      return {
        id: proof.id,
        status: proof.status,
        mime: proof.mime,
        size: proof.size,
        created_at: proof.created_at,
        rejection_reason: proof.rejection_reason,
        duplicate_in_other_order: sameHash.some(
          (other) => other.sha256 === proof.sha256 && other.order_id !== proof.order_id
        ),
        order: order
          ? {
              id: order.id,
              display_id: order.display_id,
              email: order.email,
              total: MathBN.convert(order.total as never).toNumber(),
              currency_code: order.currency_code,
            }
          : null,
        file_url: `/admin/transfer-proofs/${proof.id}/file?token=${signProofLink(proof.id, proofSecret())}`,
      }
    }),
  })
}
