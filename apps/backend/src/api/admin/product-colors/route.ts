import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { COLOR_FIELDS, extractColors } from "../../../lib/product-colors/extract"
import { normalizeHex } from "../../../modules/product-color/hex"
import { setOptionValueColorWorkflow } from "../../../workflows/set-option-value-color"

const COLOR_INVALID = (message: string) => ({
  type: "invalid_data",
  code: "COLOR_INVALID",
  message,
})

/**
 * Lista las muestras de color de los valores de la opción "Color" de un
 * producto: GET /admin/product-colors?product_id=prod_123
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const productId = req.query.product_id
  if (typeof productId !== "string" || !productId) {
    res.status(422).json(COLOR_INVALID("Indicá el producto (product_id)."))
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: COLOR_FIELDS,
    filters: { id: productId },
  })

  const colors = extractColors(data[0])

  res.json({ colors })
}

/** Asigna o cambia la muestra de color: POST /admin/product-colors */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { option_value_id?: unknown; hex?: unknown }

  if (typeof body.option_value_id !== "string" || !body.option_value_id) {
    res.status(422).json(COLOR_INVALID("Indicá el valor de opción (option_value_id)."))
    return
  }
  const hex = normalizeHex(body.hex)
  if (!hex) {
    res.status(422).json(COLOR_INVALID("El color debe tener el formato #RRGGBB."))
    return
  }

  try {
    const { result } = await setOptionValueColorWorkflow(req.scope).run({
      input: { option_value_id: body.option_value_id, hex },
    })
    res.json({
      product_color: { option_value_id: body.option_value_id, hex: result.hex },
    })
  } catch (error) {
    // Los workflows reconstruyen el error, así que se compara por tipo y no por clase.
    const failure = error as { type?: string; message?: string }
    if (failure?.type === MedusaError.Types.INVALID_DATA) {
      res.status(422).json(COLOR_INVALID(failure.message ?? "Color inválido."))
      return
    }
    throw error
  }
}
