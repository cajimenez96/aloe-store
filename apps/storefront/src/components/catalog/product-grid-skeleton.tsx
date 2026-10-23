/** Esqueleto de carga del listado (planning.md, HU-16). */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-busy="true"
      aria-label="Cargando productos"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="animate-pulse overflow-hidden rounded-lg border border-hairline bg-canvas-light">
          <div className="aspect-[4/5] bg-shade-30/40" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-4 w-3/4 rounded bg-shade-30/60" />
            <div className="h-5 w-1/3 rounded bg-shade-30/60" />
          </div>
        </li>
      ))}
    </ul>
  )
}
