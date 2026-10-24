import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Pago devuelto | Aloe", robots: { index: false } }

export default function RefundedPaymentPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl">Te devolvimos el pago</h1>
      <p>
        Recibimos tu pago, pero la última unidad se agotó justo antes de confirmar el pedido, así que no pudimos armarlo y
        te devolvimos el dinero. Puede demorar unos días en verse en tu tarjeta. Te mandamos un email con los detalles.
      </p>
      <Button asChild>
        <Link href="/productos">Ver productos</Link>
      </Button>
    </main>
  )
}
