import { MedusaError, ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_COLOR_MODULE } from "../modules/product-color"
import type ProductColorModuleService from "../modules/product-color/service"

export type SetOptionValueColorInput = {
  option_value_id: string
  hex: string
}

type Existing = { id: string; hex: string } | null

// Lo que hace falta para deshacer el paso, con una forma única.
type Rollback = {
  optionValueId: string
  previous: Existing
  createdId: string | null
}

const isColorOption = (title: unknown) =>
  typeof title === "string" && title.trim().toLowerCase() === "color"

const upsertColorStep = createStep(
  "upsert-color",
  async (input: SetOptionValueColorInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service: ProductColorModuleService = container.resolve(PRODUCT_COLOR_MODULE)

    const { data } = await query.graph({
      entity: "product_option_value",
      fields: ["id", "option.title", "product_color.id", "product_color.hex"],
      filters: { id: input.option_value_id },
    })
    const value = data[0]
    if (!value) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No existe ese valor de opción."
      )
    }
    if (!isColorOption(value.option?.title)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "La muestra de color solo se asigna a valores de la opción Color."
      )
    }

    const existing: Existing = value.product_color
      ? { id: value.product_color.id, hex: value.product_color.hex }
      : null

    if (existing) {
      const updated = await service.updateProductColors({
        id: existing.id,
        hex: input.hex,
      })
      return new StepResponse<typeof updated, Rollback>(updated, {
        optionValueId: input.option_value_id,
        previous: existing,
        createdId: null,
      })
    }

    const created = await service.createProductColors({ hex: input.hex })
    const link = container.resolve(ContainerRegistrationKeys.LINK)
    await link.create({
      [Modules.PRODUCT]: { product_option_value_id: input.option_value_id },
      [PRODUCT_COLOR_MODULE]: { product_color_id: created.id },
    })
    return new StepResponse<typeof created, Rollback>(created, {
      optionValueId: input.option_value_id,
      previous: null,
      createdId: created.id,
    })
  },
  async (rollback: Rollback | undefined, { container }) => {
    if (!rollback) {
      return
    }
    const service: ProductColorModuleService = container.resolve(PRODUCT_COLOR_MODULE)
    if (rollback.previous) {
      await service.updateProductColors({
        id: rollback.previous.id,
        hex: rollback.previous.hex,
      })
      return
    }
    if (rollback.createdId) {
      const link = container.resolve(ContainerRegistrationKeys.LINK)
      await link.dismiss({
        [Modules.PRODUCT]: { product_option_value_id: rollback.optionValueId },
        [PRODUCT_COLOR_MODULE]: { product_color_id: rollback.createdId },
      })
      await service.deleteProductColors(rollback.createdId)
    }
  }
)

/** Crea o actualiza la muestra de color de un valor de la opción "Color". */
export const setOptionValueColorWorkflow = createWorkflow(
  "set-option-value-color",
  (input: SetOptionValueColorInput) => {
    const color = upsertColorStep(input)
    return new WorkflowResponse(color)
  }
)
