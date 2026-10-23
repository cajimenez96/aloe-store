import { CaretLeft } from "@phosphor-icons/react/dist/ssr"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ProductDetail } from "@/components/product/product-detail"
import { getProductByHandle, getProductColors, getRegion, getTransferPercent } from "@/lib/data"
import { addOneToCart } from "@/lib/cart/actions"
import { buildDetailModel } from "@/lib/product"

export const metadata: Metadata = {
  title: "Producto | Aloe",
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando el producto" className="grid animate-pulse gap-10 md:grid-cols-2">
      <div className="aspect-[4/5] rounded-lg bg-shade-30/40" />
      <div className="flex flex-col gap-6">
        <div className="h-10 w-3/4 rounded bg-shade-30/60" />
        <div className="h-7 w-1/3 rounded bg-shade-30/60" />
        <div className="h-12 w-2/3 rounded bg-shade-30/60" />
      </div>
    </div>
  )
}

async function Detail({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  if (!/^[a-z0-9-]{1,200}$/.test(handle)) {
    notFound()
  }

  const region = await getRegion()
  if (!region) {
    throw new Error("No hay una región configurada. Ejecutá `npm run setup:store`.")
  }

  const product = await getProductByHandle(handle, region.id)
  if (!product) {
    notFound()
  }

  const [colors, transferPercent] = await Promise.all([
    getProductColors(product.id),
    getTransferPercent(),
  ])

  return (
    <ProductDetail
      model={buildDetailModel(product, colors)}
      transferPercent={transferPercent}
      onAdd={addOneToCart}
    />
  )
}

export default function ProductPage(props: PageProps<"/productos/[handle]">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <Link href="/productos" className="inline-flex items-center gap-1 text-sm text-shade-60 hover:text-ink">
        <CaretLeft aria-hidden="true" /> Volver a productos
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Detail params={props.params} />
      </Suspense>
    </main>
  )
}
