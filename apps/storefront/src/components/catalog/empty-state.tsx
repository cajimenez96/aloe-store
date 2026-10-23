import Link from "next/link"
import { Button } from "@/components/ui/button"

/** Sin resultados: mensaje y botón para limpiar los filtros (planning.md, HU-16). */
export function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-hairline bg-canvas-light px-6 py-16 text-center">
      <h2 className="text-xl">No encontramos productos</h2>
      <p className="max-w-md text-shade-60">
        {filtered
          ? "Probá con otra búsqueda o quitá los filtros para ver todo el catálogo."
          : "Todavía no hay productos publicados. Volvé en unos días."}
      </p>
      {filtered && (
        <Button asChild variant="outline">
          <Link href="/productos">Limpiar filtros</Link>
        </Button>
      )}
    </div>
  )
}
