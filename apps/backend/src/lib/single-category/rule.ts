import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

type Row = { id: string; title: string; categories?: { id: string }[] | null }
type Offender = { id: string; title: string }

/**
 * Un producto va en una sola categoría o subcategoría (guía de categorías;
 * planning.md, HU-07). Devuelve los que tienen más de una.
 */
export function productsBreakingRule(rows: Row[]): Offender[] {
  return rows
    .filter((row) => (row.categories?.length ?? 0) > 1)
    .map(({ id, title }) => ({ id, title }))
}

/** Productos que quedarían en dos categorías al agregarlos a `targetCategoryId`. */
export function productsWouldBreakRule(rows: Row[], targetCategoryId: string): Offender[] {
  return rows
    .filter((row) => (row.categories ?? []).some((category) => category.id !== targetCategoryId))
    .map(({ id, title }) => ({ id, title }))
}

async function load(container: MedusaContainer, productIds: string[]): Promise<Row[]> {
  if (productIds.length === 0) return []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "categories.id"],
    filters: { id: productIds },
  })
  return data as Row[]
}

function reject(offenders: Offender[]): never {
  const names = offenders.map((o) => `"${o.title}"`).join(", ")
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Un producto va en una sola categoría. Revisá: ${names}.`,
    "PRODUCT_MULTIPLE_CATEGORIES"
  )
}

/** Tras crear o editar productos: ninguno puede quedar en más de una categoría. */
export async function assertSingleCategory(container: MedusaContainer, productIds: string[]) {
  const offenders = productsBreakingRule(await load(container, productIds))
  if (offenders.length > 0) reject(offenders)
}

/** Antes de agregar productos a una categoría desde su pantalla. */
export async function assertCanAddToCategory(
  container: MedusaContainer,
  productIds: string[],
  categoryId: string
) {
  const offenders = productsWouldBreakRule(await load(container, productIds), categoryId)
  if (offenders.length > 0) reject(offenders)
}
