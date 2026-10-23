import { ShoppingBag } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Suspense } from "react"
import { getCart } from "@/lib/cart/api"
import { buildCartView } from "@/lib/cart/model"

async function CartLink() {
  const { itemCount } = buildCartView(await getCart())
  return <CartAnchor count={itemCount} />
}

function CartAnchor({ count }: { count: number }) {
  return (
    <Link
      href="/carrito"
      aria-label={count > 0 ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito"}
      className="inline-flex items-center gap-2 text-sm"
    >
      <ShoppingBag size={22} aria-hidden="true" />
      {count > 0 && <span>{count}</span>}
    </Link>
  )
}

export function SiteHeader() {
  return (
    <header className="border-b border-hairline bg-canvas-light">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/productos" className="font-display text-2xl">
          Aloe
        </Link>
        <Suspense fallback={<CartAnchor count={0} />}>
          <CartLink />
        </Suspense>
      </div>
    </header>
  )
}
