"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { placeOrder } from "@/lib/checkout/actions"

type ConfirmOrderProps = {
  /** Falta algo para poder confirmar: qué es, para decírselo al cliente. */
  blocker: string | null
}

/** Confirma el pedido (planning.md, HU-21 y HU-27). Sin medio de pago ni datos no se puede. */
export function ConfirmOrder({ blocker }: ConfirmOrderProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      const result = await placeOrder()
      if (result && !result.ok) setError(result.error.message)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={confirm} disabled={Boolean(blocker) || pending} className="w-full md:w-auto">
        {pending ? "Confirmando…" : "Confirmar pedido"}
      </Button>
      {blocker && <p className="text-sm text-shade-60">{blocker}</p>}
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
