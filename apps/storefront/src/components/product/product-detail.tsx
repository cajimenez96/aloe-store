"use client"

import { ImageSquare } from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VariantSelector } from "@/components/product/variant-selector"
import { formatPrice, transferPrice } from "@/lib/price"
import type { DetailModel } from "@/lib/product"
import { findVariant, type Selection } from "@/lib/variants"

export type AddResult = { ok: true } | { ok: false; error: { message: string } }

type ProductDetailProps = {
  model: DetailModel
  /** Porcentaje de descuento por transferencia. 0 o ausente: no se muestra. */
  transferPercent?: number
  /** Agrega una unidad de la variante al carrito (Server Action, HU-17). */
  onAdd?: (variantId: string) => Promise<AddResult | void>
}

/**
 * Ficha de producto: galería, selector de talle y color, precio de lista y por
 * transferencia, y disponibilidad. Solo se pueden elegir combinaciones que
 * existen; una variante agotada se marca y no se puede agregar (planning.md, HU-14).
 */
export function ProductDetail({ model, transferPercent = 0, onAdd }: ProductDetailProps) {
  const [selection, setSelection] = useState<Selection>({})
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  const variant = findVariant(model.selectorVariants, selection, model.options.length)
  const price = variant ? model.prices[variant.id] : undefined
  const prices = Object.values(model.prices)
  const lowest = prices.length ? Math.min(...prices.map((p) => p.amount)) : null
  const currencyCode = (price ?? prices[0])?.currencyCode ?? "ars"
  const shown = price?.amount ?? lowest
  const transfer = shown === null ? null : transferPrice(shown, transferPercent)
  const hasTransfer = shown !== null && transfer !== null && transfer < shown

  const canBuy = Boolean(variant?.inStock && price)
  const status = !variant
    ? "Elegí las opciones para ver la disponibilidad."
    : !price
      ? "Esta combinación no está disponible para la compra."
      : variant.inStock
        ? "Disponible."
        : "Agotado."

  const add = async () => {
    if (!variant || !canBuy || !onAdd) return
    setAdding(true)
    setFeedback(null)
    try {
      const result = await onAdd(variant.id)
      if (result) {
        setFeedback(
          result.ok
            ? { ok: true, message: "Agregado al carrito." }
            : { ok: false, message: result.error.message }
        )
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-hairline bg-canvas">
          {model.images[0] ? (
            <Image
              src={model.images[0]}
              alt={model.title}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label={`${model.title}, sin imagen`}
              className="flex h-full items-center justify-center text-shade-40"
            >
              <ImageSquare size={64} weight="light" aria-hidden="true" />
            </div>
          )}
        </div>
        {model.images.length > 1 && (
          <ul className="grid grid-cols-4 gap-3">
            {model.images.slice(1, 5).map((src) => (
              <li key={src} className="relative aspect-square overflow-hidden rounded-md border border-hairline">
                <Image src={src} alt="" fill sizes="12vw" className="object-cover" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl">{model.title}</h1>

        <div className="flex flex-col gap-2">
          {shown !== null ? (
            <>
              <p className="text-2xl">
                {price ? "" : prices.length > 1 ? "Desde " : ""}
                {formatPrice(shown, currencyCode)}
              </p>
              {hasTransfer && transfer !== null && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-shade-60">
                  <Badge>{`-${transferPercent}% por transferencia`}</Badge>
                  <span className="text-ink">{formatPrice(transfer, currencyCode)}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-shade-60">Este producto todavía no tiene precio.</p>
          )}
        </div>

        {model.options.length > 0 && (
          <VariantSelector
            options={model.options}
            variants={model.selectorVariants}
            selection={selection}
            onChange={(optionId, value) =>
              setSelection((current) => ({ ...current, [optionId]: value }))
            }
          />
        )}

        <p aria-live="polite" className="text-sm text-shade-60">
          {status}
        </p>

        <Button onClick={add} disabled={!canBuy || adding} className="w-full md:w-auto">
          {variant && price && !variant.inStock ? "Agotado" : "Agregar al carrito"}
        </Button>

        <div aria-live="polite" role={feedback && !feedback.ok ? "alert" : "status"} className="text-sm">
          {feedback &&
            (feedback.ok ? (
              <p className="flex flex-wrap items-center gap-3">
                {feedback.message}
                <Link href="/carrito" className="underline underline-offset-4">
                  Ver carrito
                </Link>
              </p>
            ) : (
              <p className="text-ink">{feedback.message}</p>
            ))}
        </div>

        {model.description && (
          <div className="flex flex-col gap-2 border-t border-hairline pt-6">
            <h2 className="text-sm text-shade-60">Descripción</h2>
            <p className="whitespace-pre-line">{model.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
