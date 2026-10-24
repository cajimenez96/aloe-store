import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Verificando tu pago | Aloe", robots: { index: false } }

export default function PendingPaymentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl">Todavía no vemos tu pago</h1>
      <p>
        Mercado Pago puede demorar unos minutos en avisarnos. Si ya pagaste, verificalo de nuevo en un rato; apenas lo
        confirmemos te llevamos a tu pedido y te mandamos un email.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/pago/volver">Verificar mi pago</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/checkout">Volver al checkout</Link>
        </Button>
      </div>
    </main>
  )
}
