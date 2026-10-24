"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { placeOrder, startCardPayment } from "@/lib/checkout/actions"

type ConfirmOrderProps = {
  /** Falta algo para poder confirmar: qué es, para decírselo al cliente. */
  blocker: string | null
  /** Con tarjeta el pago se hace en Mercado Pago; con transferencia se confirma el pedido. */
  method?: "card" | "transfer" | null
}

/** Confirma el pedido (planning.md, HU-21 y HU-27). Sin medio de pago ni datos no se puede. */
export function ConfirmOrder({ blocker, method = null }: ConfirmOrderProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      if (method === "card") {
        const result = await startCardPayment()
        if (result.ok) window.location.assign(result.url)
        else setError(result.error.message)
        return
      }
      const result = await placeOrder()
      if (result && !result.ok) setError(result.error.message)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={confirm} disabled={Boolean(blocker) || pending} className="w-full md:w-auto">
        {pending ? (method === "card" ? "Conectando…" : "Confirmando…") : method === "card" ? "Pagar con tarjeta" : "Confirmar pedido"}
      </Button>
      {blocker && <p className="text-sm text-shade-60">{blocker}</p>}
      {method === "card" && (
        <p className="text-sm text-shade-60">
          Pagás en Mercado Pago. Si ya pagaste y volviste a la tienda,{" "}
          <Link href="/pago/volver" className="underline underline-offset-4">
            verificá tu pago
          </Link>
          .
        </p>
      )}
      <p className="text-sm text-shade-60">
        Al confirmar aceptás los{" "}
        <Link href="/terminos" className="underline underline-offset-4">
          términos y condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </p>
      <div role="alert" className="min-h-5 text-sm">
        {error}
      </div>
    </div>
  )
}
