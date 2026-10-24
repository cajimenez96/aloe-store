import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { getOrder } from "@/lib/order/api"
import { formatPrice } from "@/lib/price"

export const metadata: Metadata = {
  title: "Tu pedido | Aloe",
  robots: { index: false },
  referrer: "no-referrer",
}

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
})

async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getOrder(id)

  if (result.status === "denied") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>No encontramos ese pedido. Entrá con el enlace que te enviamos por email.</p>
        <Button asChild variant="outline">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    )
  }
  if (result.status === "unavailable") {
    return <p role="alert">No pudimos cargar tu pedido. Probá de nuevo en un momento.</p>
  }

  const { order } = result
  const money = (amount: number) => formatPrice(amount, order.currencyCode)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl">
          {order.firstName ? `¡Gracias por tu compra, ${order.firstName}!` : "¡Gracias por tu compra!"}
        </h1>
        <p>
          Pedido <strong>#{order.number}</strong> · {order.status === "pending" ? "Pendiente de pago" : order.status}
        </p>
      </header>

      {order.transfer && (
        <section aria-labelledby="pagar" className="flex flex-col gap-4 rounded-lg border border-hairline p-5">
          <h2 id="pagar" className="font-display text-2xl">
            Cómo pagar
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-shade-60">Monto exacto</dt>
            <dd className="text-lg">{money(order.total)}</dd>
            <dt className="text-shade-60">Titular</dt>
            <dd>{order.transfer.bank.holder}</dd>
            <dt className="text-shade-60">CBU o CVU</dt>
            <dd className="break-all">{order.transfer.bank.cbu}</dd>
            <dt className="text-shade-60">Alias</dt>
            <dd>{order.transfer.bank.alias}</dd>
            <dt className="text-shade-60">Banco</dt>
            <dd>{order.transfer.bank.bank}</dd>
            <dt className="text-shade-60">Referencia</dt>
            <dd>{order.transfer.reference}</dd>
            {order.transfer.dueAt && (
              <>
                <dt className="text-shade-60">Vence</dt>
                <dd>{dateTime.format(order.transfer.dueAt)}</dd>
              </>
            )}
          </dl>
          <ol className="list-decimal pl-5 text-sm">
            <li>Transferí el monto exacto e indicá la referencia.</li>
            <li>Guardá el comprobante de tu banco.</li>
            <li>Cuando el pago se acredite, te avisamos por email.</li>
          </ol>
          <p className="text-sm text-shade-60">
            Si no se acredita antes del vencimiento, el pedido se cancela y el stock se libera. Te enviamos estos datos
            por email.
          </p>
        </section>
      )}

      <section aria-labelledby="detalle" className="flex flex-col gap-4">
        <h2 id="detalle" className="font-display text-2xl">
          Detalle
        </h2>
        <ul className="flex flex-col divide-y divide-hairline border-y border-hairline">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-4 py-3">
              <span>
                {item.quantity} × {item.title}
                {item.variantTitle ? ` (${item.variantTitle})` : ""}
              </span>
              <span>{money(item.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt>Descuento por transferencia</dt>
              <dd>-{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Entrega</dt>
            <dd>{order.shippingName ?? "-"}</dd>
          </div>
          <div className="flex justify-between text-base">
            <dt>Total</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

export default function OrderPage(props: PageProps<"/pedido/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <Suspense fallback={<p aria-busy="true">Cargando tu pedido…</p>}>
        <Order params={props.params} />
      </Suspense>
    </main>
  )
}
