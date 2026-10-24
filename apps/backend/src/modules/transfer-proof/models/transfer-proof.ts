import { model } from "@medusajs/framework/utils"

// Comprobante de una transferencia (arquitectura.md, sección 11). El archivo vive
// en el almacenamiento privado y acá solo se guarda su clave generada, nunca el
// nombre original (seguridad.md, SEC-51).
const TransferProof = model
  .define("transfer_proof", {
    id: model.id({ prefix: "tp" }).primaryKey(),
    order_id: model.text(),
    status: model.enum(["pending_review", "accepted", "rejected"]).default("pending_review"),
    storage_key: model.text(),
    sha256: model.text(),
    mime: model.text(),
    size: model.number(),
    rejection_reason: model.text().nullable(),
    review_note: model.text().nullable(),
    reviewed_by: model.text().nullable(),
    reviewed_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["order_id"] }, { on: ["sha256"] }, { on: ["status"] }])

export default TransferProof
