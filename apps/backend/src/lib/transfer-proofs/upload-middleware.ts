import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import multer from "multer"
import { MAX_PROOF_BYTES } from "./validate"

// Un solo archivo en memoria. El límite es 1 byte más que el máximo para poder
// distinguir "demasiado grande" de "justo el máximo".
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES + 1, files: 1, fields: 0 },
}).single("file")

/** Recibe el multipart del comprobante y traduce los errores de multer al catálogo. */
export function receiveProofUpload(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  upload(req as never, res as never, (error?: unknown) => {
    if (!error) return next()
    const code = (error as { code?: string }).code
    if (code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        type: "invalid_data",
        code: "TRANSFER_PROOF_TOO_LARGE",
        message: "El archivo supera los 5 MB. Comprimí la imagen o subí un PDF.",
      })
    }
    return res.status(415).json({
      type: "invalid_data",
      code: "TRANSFER_PROOF_FORMAT_INVALID",
      message: "No pudimos leer el archivo. Subí un JPG, PNG o PDF.",
    })
  })
}
