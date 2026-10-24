import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { assertSingleCategory } from "../../lib/single-category/rule"

// Un producto va en una sola categoría (planning.md, HU-07). Si falla, Medusa
// deshace el alta o el cambio.
createProductsWorkflow.hooks.productsCreated(async ({ products }, { container }) => {
  await assertSingleCategory(container, products.map((p) => p.id))
  return new StepResponse()
})

updateProductsWorkflow.hooks.productsUpdated(async ({ products }, { container }) => {
  await assertSingleCategory(container, products.map((p) => p.id))
  return new StepResponse()
})
