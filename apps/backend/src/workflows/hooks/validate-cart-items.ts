import { MedusaError } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  addToCartWorkflow,
  updateLineItemInCartWorkflow,
} from "@medusajs/medusa/core-flows"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CartLimitError, checkCartItems, type VariantInfo } from "../../lib/cart-limits/check"
import { DEFAULT_SETTINGS } from "../../lib/store-settings/validation"

type Line = { variantId: string; quantity: number }

async function validate(
  container: MedusaContainer,
  cartId: string,
  buildLines: (items: { id: string; variant_id: string; quantity: number }[]) => {
    existing: Line[]
    incoming: Line[]
  }
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "sales_channel_id", "items.id", "items.variant_id", "items.quantity"],
    filters: { id: cartId },
  })
  const { existing, incoming } = buildLines(
    (cart?.items ?? []).flatMap((item) =>
      item?.variant_id ? [{ id: item.id, variant_id: item.variant_id, quantity: Number(item.quantity) }] : []
    )
  )

  const variantIds = [...new Set(incoming.map((line) => line.variantId))]
  const { data: variantRows } = await query.graph({
    entity: "variant",
    fields: ["id", "manage_inventory", "allow_backorder", "product.status"],
    filters: { id: variantIds },
  })
  const availability = cart?.sales_channel_id
    ? await getVariantAvailability(query, {
        variant_ids: variantIds,
        sales_channel_id: cart.sales_channel_id,
      })
    : {}

  const variants: Record<string, VariantInfo> = {}
  for (const row of variantRows) {
    variants[row.id] = {
      id: row.id,
      published: row.product?.status === "published",
      manageInventory: Boolean(row.manage_inventory),
      allowBackorder: Boolean(row.allow_backorder),
      available: availability[row.id]?.availability ?? null,
    }
  }

  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
  const configured = (store?.metadata as Record<string, unknown> | null | undefined)
    ?.max_units_per_variant
  const maxUnits =
    typeof configured === "number" ? configured : DEFAULT_SETTINGS.max_units_per_variant

  try {
    checkCartItems({ maxUnits, existing, incoming, variants })
  } catch (error) {
    if (error instanceof CartLimitError) {
      // El cuerpo de error de Medusa lleva `code` y `message`: el detalle va como JSON.
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, JSON.stringify(error.details), error.code)
    }
    throw error
  }
}

addToCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  await validate(container, input.cart_id, (items) => ({
    existing: items.map((i) => ({ variantId: i.variant_id, quantity: i.quantity })),
    incoming: (input.items ?? []).flatMap((item) =>
      item.variant_id ? [{ variantId: item.variant_id, quantity: Number(item.quantity) }] : []
    ),
  }))
  return new StepResponse()
})

updateLineItemInCartWorkflow.hooks.validate(async ({ input }, { container }) => {
  const quantity = input.update?.quantity
  if (quantity === undefined) {
    return new StepResponse()
  }
  await validate(container, input.cart_id, (items) => {
    const target = items.find((i) => i.id === input.item_id)
    return {
      existing: items
        .filter((i) => i.id !== input.item_id)
        .map((i) => ({ variantId: i.variant_id, quantity: i.quantity })),
      incoming: target ? [{ variantId: target.variant_id, quantity: Number(quantity) }] : [],
    }
  })
  return new StepResponse()
})
