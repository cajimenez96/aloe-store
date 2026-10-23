import Link from "next/link"
import { Button } from "@/components/ui/button"

/** Producto inexistente, despublicado o fuera del canal Web. */
export default function ProductNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-display text-3xl">No encontramos ese producto</h1>
      <p className="max-w-md text-shade-60">
        Puede que ya no esté disponible. Mirá el resto del catálogo.
      </p>
      <Button asChild>
        <Link href="/productos">Volver a productos</Link>
      </Button>
    </main>
  )
}
