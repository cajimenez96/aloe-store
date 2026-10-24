import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TRANSFER_PROOF_MODULE } from "../../../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../../../modules/transfer-proof/service"
import { verifyProofLink } from "../../../../../lib/transfer-proofs/signed-link"
import { readProof } from "../../../../../lib/transfer-proofs/storage"
import { proofSecret } from "../../../../../lib/transfer-proofs/secret"

/**
 * Entrega el archivo del comprobante (seguridad.md, SEC-51). Exige la sesión del
 * panel (el middleware de /admin) y un enlace firmado de 15 minutos. Los
 * encabezados evitan que un archivo malicioso se ejecute en el origen del panel.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const token = typeof req.query.token === "string" ? req.query.token : ""
  if (!verifyProofLink(req.params.id, token, proofSecret())) {
    return res.status(403).json({ type: "not_allowed", code: "PROOF_LINK_INVALID", message: "El enlace venció. Volvé a abrir el comprobante desde la lista." })
  }

  const proofs = req.scope.resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
  const [proof] = await proofs.listTransferProofs({ id: req.params.id })
  const buffer = proof ? await readProof(proof.storage_key) : null
  if (!proof || !buffer) {
    return res.status(404).json({ type: "not_found", message: "No encontramos el comprobante." })
  }

  res.setHeader("Content-Type", proof.mime)
  res.setHeader("Content-Disposition", `attachment; filename="comprobante-${proof.id}"`)
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Content-Security-Policy", "sandbox")
  res.status(200).end(buffer)
}
