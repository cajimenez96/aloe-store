"use client"

import { Button } from "@/components/ui/button"

/**
 * Error de red o del servidor al cargar el listado: mensaje y botón para
 * reintentar (planning.md, HU-16). No se muestra el detalle técnico al cliente.
 */
export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-3xl">No pudimos cargar los productos</h1>
      <p className="max-w-md text-shade-60">
        Hubo un problema de conexión con la tienda. Probá de nuevo en unos segundos.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  )
}
