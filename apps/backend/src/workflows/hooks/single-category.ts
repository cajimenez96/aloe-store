import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { ensureDefaultChannels } from "../../lib/sales-channels/ensure"
import { assertSingleCategory } from "../../lib/single-category/rule"

// Medusa admite un solo handler por hook, por eso las dos reglas de alta conviven acá.
// Un producto va en una sola categoría (planning.md, HU-07); si falla, Medusa deshace el alta
// o el cambio. Y todo producto nuevo se publica en «Web» y «Local» sin depender del admin.
createProductsWorkflow.hooks.productsCreated(async ({ products }, { container }) => {
  const ids = products.map((p) => p.id)
  await assertSingleCategory(container, ids)
  await ensureDefaultChannels(container, ids)
  return new StepResponse()
})

updateProductsWorkflow.hooks.productsUpdated(async ({ products }, { container }) => {
  await assertSingleCategory(container, products.map((p) => p.id))
  return new StepResponse()
})
