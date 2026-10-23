"use client"

import { Minus, Plus, Trash } from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  dropUnavailableLines,
  removeLine,
  updateLineQuantity,
  type CartActionResult,
} from "@/lib/cart/actions"
import type { CartView } from "@/lib/cart/model"
import { formatPrice, transferPrice } from "@/lib/price"

type CartLinesProps = { cart: CartView; transferPercent: number; hasUnavailable?: boolean }

/**
 * Líneas del carrito con cantidades editables. Los montos vienen de Medusa; acá
 * solo se calcula, para mostrar, el total por transferencia (planning.md, HU-15 y HU-17).
 */
export function CartLines({ cart, transferPercent, hasUnavailable = false }: CartLinesProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Las variantes despublicadas se quitan en el servidor y se avisa (HU-18).
  useEffect(() => {
    if (!hasUnavailable) return
    void dropUnavailableLines().then(({ removed }) => {
      if (removed.length > 0) {
        setNotice(
          `Quitamos de tu carrito lo que ya no está disponible: ${removed.join(", ")}.`
        )
      }
    })
  }, [hasUnavailable])

  const run = (action: () => Promise<CartActionResult>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.error.message)
    })
  }

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="status">{notice}</p>
        <p>Tu carrito está vacío.</p>
        <Button asChild>
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    )
  }

  const transfer = transferPrice(cart.total, transferPercent)
  const hasTransfer = transfer < cart.total

  return (
    <div className="flex flex-col gap-8" aria-busy={pending}>
      <p role="status" className="text-sm">
        {notice}
      </p>
      <ul className="flex flex-col divide-y divide-hairline border-y border-hairline">
        {cart.lines.map((line) => (
          <li key={line.id} className="flex gap-4 py-5">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-hairline bg-canvas">
              {line.imageUrl && (
                <Image src={line.imageUrl} alt="" fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {line.handle ? (
                    <Link href={`/productos/${line.handle}`} className="hover:underline">
                      {line.title}
                    </Link>
                  ) : (
                    <p>{line.title}</p>
                  )}
                  {line.variantTitle && <p className="text-sm text-shade-60">{line.variantTitle}</p>}
                </div>
                <p>{formatPrice(line.total, cart.currencyCode)}</p>
              </div>
              <div className="flex items-center gap-3">
                <div role="group" aria-label={`Cantidad de ${line.title}`} className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Quitar una unidad"
                    disabled={pending || line.quantity <= 1}
                    onClick={() => run(() => updateLineQuantity(line.id, line.quantity - 1))}
                  >
                    <Minus aria-hidden="true" />
                  </Button>
                  <span aria-live="polite" className="w-6 text-center">
                    {line.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Agregar una unidad"
                    disabled={pending}
                    onClick={() => run(() => updateLineQuantity(line.id, line.quantity + 1))}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => removeLine(line.id))}
                >
                  <Trash aria-hidden="true" /> Quitar
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div role="alert" className="text-sm">
        {error}
      </div>

      <dl className="flex flex-col gap-2">
        <div className="flex justify-between text-lg">
          <dt>Total</dt>
          <dd>{formatPrice(cart.total, cart.currencyCode)}</dd>
        </div>
        {hasTransfer && (
          <div className="flex justify-between text-sm text-shade-60">
            <dt>{`Pagando por transferencia (-${transferPercent}%)`}</dt>
            <dd className="text-ink">{formatPrice(transfer, cart.currencyCode)}</dd>
          </div>
        )}
      </dl>

      <Button asChild className="w-full md:w-auto md:self-end">
        <Link href="/checkout">Continuar compra</Link>
      </Button>
    </div>
  )
}
