import type { Metadata } from "next"
import { Suspense } from "react"
import { CatalogFilters } from "@/components/catalog/catalog-filters"
import { EmptyState } from "@/components/catalog/empty-state"
import { PaginationNav } from "@/components/catalog/pagination-nav"
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton"
import { ProductCard } from "@/components/product/product-card"
import {
  PAGE_SIZE,
  pagination,
  parseCatalogParams,
  summarizeProduct,
} from "@/lib/catalog"
import {
  findCategoryBranch,
  getCategoryTree,
  getRegion,
  getTransferPercent,
  listProducts,
} from "@/lib/data"

export const metadata: Metadata = {
  title: "Productos | Aloe",
  description: "Catálogo de productos de Aloe",
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Los parámetros de la URL y el stock se leen al pedir la página, así que todo
 * lo dinámico va dentro de Suspense: el esqueleto sale con la parte estática.
 */
async function Listing({ searchParams }: { searchParams: SearchParams }) {
  const params = parseCatalogParams(await searchParams)
  const [tree, region, transferPercent] = await Promise.all([
    getCategoryTree(),
    getRegion(),
    getTransferPercent(),
  ])
  if (!region) {
    throw new Error("No hay una región configurada. Ejecutá `npm run setup:store`.")
  }

  const branch = params.categoria ? findCategoryBranch(tree, params.categoria) : null
  const categoryIds = params.categoria ? (branch?.ids ?? ["categoria_inexistente"]) : null

  const { products, count } = await listProducts({
    q: params.q,
    categoryIds,
    page: params.pagina,
    regionId: region.id,
  })
  const page = pagination(count, params.pagina, PAGE_SIZE)
  const filtered = Boolean(params.q || params.categoria)

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <CatalogFilters tree={tree} params={params} />
      <div className="flex flex-col gap-6">
        {products.length === 0 ? (
          <EmptyState filtered={filtered} />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const summary = summarizeProduct(product)
                if (summary.listPrice === null) return null
                return (
                  <li key={product.id}>
                    <ProductCard
                      title={summary.title}
                      href={`/productos/${summary.handle}`}
                      imageUrl={summary.imageUrl}
                      listPrice={summary.listPrice}
                      currencyCode={summary.currencyCode}
                      transferPercent={transferPercent}
                      soldOut={summary.soldOut}
                    />
                  </li>
                )
              })}
            </ul>
            <PaginationNav params={params} count={count} {...page} />
          </>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage(props: PageProps<"/productos">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <h1 className="font-display text-4xl">Productos</h1>
      <Suspense
        fallback={
          <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
            <div />
            <ProductGridSkeleton />
          </div>
        }
      >
        <Listing searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}
