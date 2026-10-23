import type { Metadata } from "next"
import { Suspense } from "react"
import { CartLines } from "@/components/cart/cart-lines"
import { getCart, getPublishedProductIds } from "@/lib/cart/api"
import { buildCartView, findUnavailableLines } from "@/lib/cart/model"
import { getTransferPercent } from "@/lib/data"

export const metadata: Metadata = {
  title: "Carrito | Aloe",
  robots: { index: false },
}

async function Cart() {
  const [rawCart, transferPercent] = await Promise.all([getCart(), getTransferPercent()])
  const cart = buildCartView(rawCart)
  const published = await getPublishedProductIds(cart.lines.map((line) => line.productId))
  const hasUnavailable = findUnavailableLines(cart.lines, published).length > 0
  return <CartLines cart={cart} transferPercent={transferPercent} hasUnavailable={hasUnavailable} />
}

export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <h1 className="font-display text-4xl">Carrito</h1>
      <Suspense fallback={<p aria-busy="true">Cargando tu carrito…</p>}>
        <Cart />
      </Suspense>
    </main>
  )
}
