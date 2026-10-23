import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { type UploadedFile, validateImageFile } from "./validate-image"

/**
 * Middleware de POST /admin/uploads: rechaza toda la solicitud si algún archivo
 * no es una imagen válida (seguridad.md, SEC-50). Corre después de multer, que
 * deja los archivos en `req.files`.
 */
export function validateImageUploads(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const files = (req as unknown as { files?: UploadedFile[] }).files ?? []

  for (const file of files) {
    const error = validateImageFile(file)
    if (error) {
      res.status(error.status).json(error.body)
      return
    }
  }

  next()
}
