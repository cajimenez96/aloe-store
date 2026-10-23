import { cacheLife } from "next/cache"
import { PAGE_SIZE } from "./catalog"
import { getEnv } from "./env"
import { getSdk } from "./medusa"

export type CategoryNode = {
  id: string
  name: string
  handle: string
  category_children?: CategoryNode[]
}

/** Región con la moneda de la tienda (ARS). Cambia muy poco. */
export async function getRegion() {
  "use cache"
  cacheLife("hours")
  const { regions } = await getSdk().store.region.list()
  const region = regions.find((r) => r.currency_code === "ars") ?? regions[0]
  return region ? { id: region.id, currencyCode: region.currency_code } : null
}

/** Árbol de categorías activas: rubro, categoría y subcategoría. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  "use cache"
  cacheLife("minutes")
  const { product_categories } = await getSdk().store.category.list({
    include_descendants_tree: true,
    parent_category_id: "null",
    limit: 100,
    fields: "id,name,handle,category_children.id,category_children.name,category_children.handle,category_children.category_children.id,category_children.category_children.name,category_children.category_children.handle",
  })
  return product_categories as CategoryNode[]
}

/**
 * Porcentaje de descuento por transferencia, tomado de la promoción de Medusa
 * (planning.md, HU-15). Solo sirve para mostrar el precio.
 */
export async function getTransferPercent(): Promise<number> {
  "use cache"
  cacheLife("minutes")
  const { backendUrl, publishableKey } = getEnv()
  try {
    const response = await fetch(`${backendUrl}/store/checkout/transfer-discount`, {
      headers: { "x-publishable-api-key": publishableKey },
    })
    if (!response.ok) return 0
    const { percent } = (await response.json()) as { percent?: number }
    return typeof percent === "number" ? percent : 0
  } catch {
    // Sin el porcentaje se muestra solo el precio de lista: no rompe el listado.
    return 0
  }
}

/** Busca una categoría por handle y devuelve ella y todas sus descendientes. */
export function findCategoryBranch(
  tree: CategoryNode[],
  handle: string
): { node: CategoryNode; ids: string[] } | null {
  const collect = (node: CategoryNode): string[] => [
    node.id,
    ...(node.category_children ?? []).flatMap(collect),
  ]
  const search = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const node of nodes) {
      if (node.handle === handle) return node
      const found = search(node.category_children ?? [])
      if (found) return found
    }
    return null
  }
  const node = search(tree)
  return node ? { node, ids: collect(node) } : null
}

/**
 * Lista productos publicados del canal "Web" (lo determina la clave publicable).
 * No se cachea: el stock cambia con cada venta.
 */
export async function listProducts(options: {
  q: string
  categoryIds: string[] | null
  page: number
  regionId: string
}) {
  const { products, count } = await getSdk().store.product.list({
    region_id: options.regionId,
    limit: PAGE_SIZE,
    offset: (options.page - 1) * PAGE_SIZE,
    q: options.q || undefined,
    category_id: options.categoryIds ?? undefined,
    fields:
      "id,title,handle,thumbnail,*variants,*variants.calculated_price,+variants.inventory_quantity",
  })
  return { products, count }
}
