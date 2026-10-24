import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assertCanAddToCategory } from "./rule"

/**
 * `POST /admin/product-categories/:id/products` asigna productos a una categoría
 * y Medusa no ofrece un hook para ese flujo (planning.md, HU-07).
 */
export async function enforceSingleCategoryOnAdd(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const add = (req.body as { add?: unknown } | undefined)?.add
    const ids = Array.isArray(add) ? add.filter((id): id is string => typeof id === "string") : []
    await assertCanAddToCategory(req.scope, ids, req.params.id)
    next()
  } catch (error) {
    next(error)
  }
}
