export type ProductChannels = { id: string; sales_channels?: { id: string }[] | null }

/** Ids de los productos que todavía no están vinculados al canal. */
export function productsMissingChannel(products: ProductChannels[], channelId: string): string[] {
  return products.filter((product) => !(product.sales_channels ?? []).some((channel) => channel.id === channelId)).map((product) => product.id)
}
