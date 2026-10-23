import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { validateDiscountPayment } from "../../lib/transfer-discount/validate-cart"

// Último control antes de crear el pedido (seguridad.md, SEC-31; HU-22).
completeCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await validateDiscountPayment(container, input.id)
  return new StepResponse()
})
