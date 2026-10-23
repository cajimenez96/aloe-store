import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buildCatalogHref, type CatalogParams } from "@/lib/catalog"

type Props = {
  params: CatalogParams
  hasPrev: boolean
  hasNext: boolean
  from: number
  to: number
  count: number
}

/** Paginación con enlaces: cada página tiene su URL y se puede compartir. */
export function PaginationNav({ params, hasPrev, hasNext, from, to, count }: Props) {
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-shade-60">
        Mostrando {from} a {to} de {count}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildCatalogHref({ ...params, pagina: params.pagina - 1 })} rel="prev">
              <CaretLeft aria-hidden="true" /> Anterior
            </Link>
          </Button>
        ) : null}
        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildCatalogHref({ ...params, pagina: params.pagina + 1 })} rel="next">
              Siguiente <CaretRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  )
}
