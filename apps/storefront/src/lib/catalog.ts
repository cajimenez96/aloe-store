/** Cantidad de productos por página del listado. */
export const PAGE_SIZE = 12

export type CatalogParams = {
  q: string
  /** Handle de la categoría, por ejemplo "ropa-interior". */
  categoria: string | null
  pagina: number
}

type RawParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

/**
 * Lee los filtros de la URL. Todo lo que no se reconoce vuelve al valor por
 * defecto: la URL es entrada del usuario y no se confía en ella (SEC-61).
 */
export function parseCatalogParams(raw: RawParams): CatalogParams {
  const q = (first(raw.q) ?? "").trim().slice(0, 100)

  const categoriaRaw = first(raw.categoria) ?? ""
  const categoria = /^[a-z0-9-]{1,100}$/.test(categoriaRaw) ? categoriaRaw : null

  const paginaRaw = first(raw.pagina) ?? ""
  const pagina = /^\d{1,4}$/.test(paginaRaw) && Number(paginaRaw) >= 1 ? Number(paginaRaw) : 1

  return { q, categoria, pagina }
}

/** Arma la URL del listado con solo los parámetros que no son el valor por defecto. */
export function buildCatalogHref(params: CatalogParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.categoria) search.set("categoria", params.categoria)
  if (params.pagina > 1) search.set("pagina", String(params.pagina))
  const query = search.toString()
  return query ? `/productos?${query}` : "/productos"
}

export function pagination(count: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(count / pageSize)
  if (totalPages === 0) {
    return { totalPages: 0, hasPrev: false, hasNext: false, from: 0, to: 0 }
  }
  return {
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, count),
  }
}

type SummaryVariant = {
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
}

type SummaryProduct = {
  title: string
  handle: string
  thumbnail?: string | null
  variants?: SummaryVariant[] | null
}

export type ProductSummary = {
  title: string
  handle: string
  imageUrl: string | null
  /** Menor precio de lista entre las variantes, en la unidad de la moneda. */
  listPrice: number | null
  currencyCode: string
  soldOut: boolean
}

const hasStock = (variant: SummaryVariant) =>
  !variant.manage_inventory ||
  Boolean(variant.allow_backorder) ||
  (variant.inventory_quantity ?? 0) > 0

/** Resume un producto de la API de tienda para mostrarlo en una tarjeta. */
export function summarizeProduct(product: SummaryProduct): ProductSummary {
  const variants = product.variants ?? []
  const priced = variants.filter(
    (v) => typeof v.calculated_price?.calculated_amount === "number"
  )
  const amounts = priced.map((v) => v.calculated_price!.calculated_amount as number)

  return {
    title: product.title,
    handle: product.handle,
    imageUrl: product.thumbnail ?? null,
    listPrice: amounts.length ? Math.min(...amounts) : null,
    currencyCode: priced[0]?.calculated_price?.currency_code ?? "ars",
    soldOut: variants.length > 0 && !variants.some(hasStock),
  }
}
