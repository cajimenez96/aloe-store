"use client"

import { useState, useTransition } from "react"
import { choosePaymentMethod } from "@/lib/checkout/actions"
import { formatPrice, transferPrice } from "@/lib/price"

type Method = "card" | "transfer"

type PaymentMethodProps = {
  initial: Method | null
  /** Total con el medio ya elegido, calculado por Medusa. */
  total: number
  /** Productos sin descuento y envío: el descuento de transferencia solo alcanza a los productos. */
  itemsSubtotal: number
  shippingTotal: number
  currencyCode: string
  transferPercent: number
}

/**
 * Medio de pago (planning.md, HU-21). Al cambiar, el backend aplica o quita la
 * promoción y el total se actualiza antes de confirmar. Pagar con tarjeta se
 * conecta en HU-24.
 */
export function PaymentMethod({ initial, total, itemsSubtotal, shippingTotal, currencyCode, transferPercent }: PaymentMethodProps) {
  const [selected, setSelected] = useState<Method | null>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const pick = (method: Method) => {
    const previous = selected
    setSelected(method)
    setError(null)
    startTransition(async () => {
      const result = await choosePaymentMethod(method)
      if (!result.ok) {
        setSelected(previous)
        setError(result.error.message)
      }
    })
  }

  const listTotal = itemsSubtotal + shippingTotal
  const transferTotal = transferPrice(itemsSubtotal, transferPercent) + shippingTotal
  const hasTransfer = transferPercent > 0 && transferTotal < listTotal

  return (
    <fieldset className="flex flex-col gap-3" aria-busy={pending}>
      <legend className="mb-2 font-display text-2xl">Medio de pago</legend>

      {hasTransfer && (
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-hairline px-4 py-3 has-[:checked]:border-ink">
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="paymentMethod"
              value="transfer"
              checked={selected === "transfer"}
              disabled={pending}
              onChange={() => pick("transfer")}
            />
            {`Transferencia (-${transferPercent}%)`}
          </span>
          <span className="text-shade-60">{formatPrice(transferTotal, currencyCode)}</span>
        </label>
      )}

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-hairline px-4 py-3 has-[:checked]:border-ink">
        <span className="flex items-center gap-3">
          <input
            type="radio"
            name="paymentMethod"
            value="card"
            checked={selected === "card"}
            disabled={pending}
            onChange={() => pick("card")}
          />
          Tarjeta
        </span>
        <span className="text-shade-60">{formatPrice(listTotal, currencyCode)}</span>
      </label>

      <div role="alert" className="min-h-5 text-sm">
        {error}
      </div>
      <p aria-live="polite" className="text-sm text-shade-60">
        {selected
          ? `Total con ${selected === "transfer" ? "transferencia" : "tarjeta"}: ${formatPrice(total, currencyCode)}`
          : "Elegí cómo querés pagar para ver el total."}
      </p>
    </fieldset>
  )
}
