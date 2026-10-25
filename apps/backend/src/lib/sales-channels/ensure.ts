import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { linkProductsToSalesChannelWorkflow } from "@medusajs/medusa/core-flows"
import { productsMissingChannel } from "./missing"

/** Canales en los que todo producto nuevo se publica: la tienda y el punto de venta. */
export const DEFAULT_CHANNELS = ["Web", "Local"]

/**
 * Vincula los productos recién creados a los canales «Web» y «Local», sin quitar los que
 * el admin haya elegido. Si un canal no existe (por ejemplo, antes de `setup:store`) lo omite.
 */
export async function ensureDefaultChannels(container: MedusaContainer, productIds: string[]) {
  if (productIds.length === 0) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: channels } = await query.graph({ entity: "sales_channel", fields: ["id", "name"], filters: { name: DEFAULT_CHANNELS } })
  const { data: products } = await query.graph({ entity: "product", fields: ["id", "sales_channels.id"], filters: { id: productIds } })

  for (const channel of channels) {
    const add = productsMissingChannel(products as never, channel.id as string)
    if (add.length === 0) continue
    await linkProductsToSalesChannelWorkflow(container).run({ input: { id: channel.id as string, add } })
  }
}
