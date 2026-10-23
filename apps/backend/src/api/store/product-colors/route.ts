import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { COLOR_FIELDS, extractColors } from "../../../lib/product-colors/extract"

/**
 * Muestras de color de un producto para la tienda:
 * GET /store/product-colors?product_id=prod_123 (planning.md, HU-14).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.query.product_id
  if (typeof productId !== "string" || !/^[A-Za-z0-9_]{1,64}$/.test(productId)) {
    res.status(422).json({
      type: "invalid_data",
      code: "COLOR_INVALID",
      message: "Indicá el producto (product_id).",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: COLOR_FIELDS,
    filters: { id: productId },
  })

  res.json({ colors: extractColors(data[0]) })
}
