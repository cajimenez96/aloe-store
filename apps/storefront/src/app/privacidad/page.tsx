import type { Metadata } from "next"
import { ProvisionalNotice } from "@/components/legal/provisional-notice"

export const metadata: Metadata = { title: "Política de privacidad | Aloe" }

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-4xl">Política de privacidad</h1>
      <ProvisionalNotice />
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Qué datos guardamos</h2>
        <p>
          Para procesar tu pedido guardamos tu nombre, email, teléfono y, si lo informás, tu documento. Si elegís envío,
          también tu dirección. Si pagás por transferencia, guardamos el comprobante que subís.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Para qué los usamos</h2>
        <p>Solo para preparar y entregar tu pedido, confirmar el pago y avisarte por email sobre su estado.</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Cuánto tiempo los conservamos</h2>
        <p>El plazo de conservación se define en el texto definitivo.</p>
      </section>
    </main>
  )
}
