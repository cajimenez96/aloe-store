import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MathBN,
  QueryContext,
  getVariantAvailability,
} from "@medusajs/framework/utils"

const MAX_RESULTS = 20
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * Búsqueda de productos del punto de venta por título o SKU (planning.md, HU-35).
 * Devuelve las variantes con el stock disponible en el canal Local; una variante
 * sin stock llega marcada para que no se pueda agregar.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : ""
  if (q.length < 1) return res.json({ products: [] })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [channel],
  } = await query.graph({ entity: "sales_channel", fields: ["id"], filters: { name: "Local" } })
  const {
    data: [region],
  } = await query.graph({ entity: "region", fields: ["id", "currency_code"], filters: { currency_code: "ars" } })
  if (!channel || !region) return res.json({ products: [] })

  const pattern = `%${escapeLike(q)}%`
  const fields = [
    "id",
    "title",
    "variants.id",
    "variants.title",
    "variants.sku",
    "variants.manage_inventory",
    "variants.allow_backorder",
    "variants.calculated_price.*",
  ]
  const context = {
    variants: { calculated_price: QueryContext({ region_id: region.id, currency_code: region.currency_code }) },
  }
  const base = { status: "published", sales_channels: { id: channel.id } }

  const [byTitle, bySku] = await Promise.all([
    query.graph({ entity: "product", fields, filters: { ...base, title: { $ilike: pattern } } as never, context, pagination: { take: MAX_RESULTS } }),
    query.graph({ entity: "product", fields, filters: { ...base, variants: { sku: { $ilike: pattern } } } as never, context, pagination: { take: MAX_RESULTS } }),
  ])

  const products = new Map<string, (typeof byTitle.data)[number]>()
  for (const product of [...byTitle.data, ...bySku.data]) products.set(product.id, product)
  const list = [...products.values()].slice(0, MAX_RESULTS)

  const variantIds = list.flatMap((product) => (product.variants ?? []).flatMap((v) => (v ? [v.id] : [])))
  const availability = variantIds.length
    ? await getVariantAvailability(query, { variant_ids: variantIds, sales_channel_id: channel.id })
    : {}

  res.json({
    products: list.map((product) => ({
      id: product.id,
      title: product.title,
      variants: (product.variants ?? []).flatMap((variant) => {
        if (!variant) return []
        const priced = variant as typeof variant & { calculated_price?: { calculated_amount?: unknown } | null }
        const amount = priced.calculated_price?.calculated_amount
        const limited = variant.manage_inventory && !variant.allow_backorder
        const available = availability[variant.id]?.availability ?? null
        return [
          {
            id: variant.id,
            title: variant.title,
            sku: variant.sku ?? null,
            price: amount === undefined || amount === null ? null : MathBN.convert(amount as never).toNumber(),
            available: limited ? (available ?? 0) : null,
            in_stock: !limited || (available ?? 0) > 0,
          },
        ]
      }),
    })),
  })
}
