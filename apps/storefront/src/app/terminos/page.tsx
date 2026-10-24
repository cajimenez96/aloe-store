import type { Metadata } from "next"
import { ProvisionalNotice } from "@/components/legal/provisional-notice"

export const metadata: Metadata = { title: "Términos y condiciones | Aloe" }

export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl">Términos y condiciones</h1>
      <ProvisionalNotice />
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Compras</h2>
        <p>
          Los precios están expresados en pesos argentinos y son los finales: no se agregan impuestos ni cargos. El
          pedido queda confirmado cuando recibimos el pago.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Pago por transferencia</h2>
        <p>
          Tenés un plazo para transferir y subir el comprobante. Si el plazo vence sin un comprobante aceptado, el pedido
          se cancela y el stock se libera.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Entrega</h2>
        <p>Podés retirar en el local o pedir un envío a domicilio. El costo del envío se coordina con el comercio.</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Cambios y devoluciones</h2>
        <p>Este apartado se completa con el texto definitivo.</p>
      </section>
    </main>
  )
}
