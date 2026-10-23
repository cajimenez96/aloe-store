import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buildCatalogHref, type CatalogParams } from "@/lib/catalog"
import type { CategoryNode } from "@/lib/data"
import { cn } from "@/lib/utils"

function CategoryList({
  nodes,
  params,
  depth = 0,
}: {
  nodes: CategoryNode[]
  params: CatalogParams
  depth?: number
}) {
  return (
    <ul className={cn("flex flex-col gap-1", depth > 0 && "ml-4 mt-1 border-l border-hairline pl-3")}>
      {nodes.map((node) => {
        const current = params.categoria === node.handle
        return (
          <li key={node.id}>
            <Link
              href={buildCatalogHref({ ...params, categoria: node.handle, pagina: 1 })}
              aria-current={current ? "page" : undefined}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm hover:bg-canvas-light",
                current ? "bg-canvas-light font-medium text-ink" : "text-shade-60"
              )}
            >
              {node.name}
            </Link>
            {node.category_children?.length ? (
              <CategoryList nodes={node.category_children} params={params} depth={depth + 1} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Búsqueda por título y filtro por rubro, categoría y subcategoría. */
export function CatalogFilters({
  tree,
  params,
}: {
  tree: CategoryNode[]
  params: CatalogParams
}) {
  const filtered = Boolean(params.q || params.categoria)
  return (
    <aside className="flex flex-col gap-6">
      <form action="/productos" method="get" role="search" className="flex flex-col gap-2">
        <label htmlFor="q" className="text-sm text-shade-60">
          Buscar por nombre
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={100}
            placeholder="Bombacha, pijama..."
            className="min-h-11 w-full rounded-pill border border-hairline bg-canvas-light px-4 text-sm"
          />
          {params.categoria ? <input type="hidden" name="categoria" value={params.categoria} /> : null}
          <Button type="submit" size="sm" aria-label="Buscar">
            <MagnifyingGlass aria-hidden="true" />
          </Button>
        </div>
      </form>

      {tree.length > 0 && (
        <nav aria-label="Categorías" className="flex flex-col gap-2">
          <h2 className="text-sm text-shade-60">Categorías</h2>
          <CategoryList nodes={tree} params={params} />
        </nav>
      )}

      {filtered && (
        <Link href="/productos" className="text-sm underline underline-offset-4">
          Limpiar filtros
        </Link>
      )}
    </aside>
  )
}
