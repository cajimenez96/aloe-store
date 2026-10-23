import type { SelectorOption } from "@/components/product/variant-selector"
import type { SelectorVariant } from "./variants"

export type ColorEntry = { option_value_id: string; value: string; hex: string | null }

type DetailVariant = {
  id: string
  title?: string | null
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
  options?: { option_id?: string | null; value?: string | null }[] | null
}

type DetailProduct = {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  options?: {
    id: string
    title: string
    values?: { id: string; value: string }[] | null
  }[] | null
  variants?: DetailVariant[] | null
}

export type DetailModel = {
  id: string
  title: string
  description: string
  images: string[]
  options: SelectorOption[]
  selectorVariants: SelectorVariant[]
  /** Precio de lista por variante, en la unidad de la moneda. Falta si no tiene precio. */
  prices: Record<string, { amount: number; currencyCode: string }>
}

const hasPrice = (variant: DetailVariant) =>
  typeof variant.calculated_price?.calculated_amount === "number"

// Sin precio no se puede comprar, aunque haya stock.
const isPurchasable = (variant: DetailVariant) =>
  hasPrice(variant) &&
  (!variant.manage_inventory ||
    Boolean(variant.allow_backorder) ||
    (variant.inventory_quantity ?? 0) > 0)

/**
 * Convierte un producto de la API de tienda y sus muestras de color en lo que
 * necesita la ficha: opciones para el selector, variantes con stock y precios.
 */
export function buildDetailModel(product: DetailProduct, colors: ColorEntry[]): DetailModel {
  const hexByValueId = new Map(colors.map((c) => [c.option_value_id, c.hex]))
  const variants = product.variants ?? []

  const gallery = (product.images ?? []).map((image) => image.url)

  return {
    id: product.id,
    title: product.title,
    description: product.description ?? "",
    images: gallery.length ? gallery : product.thumbnail ? [product.thumbnail] : [],
    options: (product.options ?? []).map((option) => ({
      id: option.id,
      title: option.title,
      values: (option.values ?? []).map((value) =>
        hexByValueId.has(value.id)
          ? { id: value.id, value: value.value, hex: hexByValueId.get(value.id) ?? null }
          : { id: value.id, value: value.value }
      ),
    })),
    selectorVariants: variants.map((variant) => ({
      id: variant.id,
      inStock: isPurchasable(variant),
      options: (variant.options ?? []).map((o) => ({
        option_id: o.option_id ?? "",
        value: o.value ?? "",
      })),
    })),
    prices: Object.fromEntries(
      variants.filter(hasPrice).map((variant) => [
        variant.id,
        {
          amount: variant.calculated_price!.calculated_amount as number,
          currencyCode: variant.calculated_price!.currency_code ?? "ars",
        },
      ])
    ),
  }
}
