import { ImageSquare } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { formatPrice, transferPrice } from "@/lib/price"

type ProductCardProps = {
  title: string
  href: string
  imageUrl?: string | null
  imageAlt?: string
  /** Precio de lista, en la unidad de la moneda. Es lo que se cobra con tarjeta. */
  listPrice: number
  currencyCode: string
  /** Porcentaje de descuento por transferencia. Si es 0 o no está, no se muestra. */
  transferPercent?: number
  soldOut?: boolean
}

/**
 * Tarjeta de producto del listado: precio de lista y, si hay descuento, el
 * precio por transferencia con su porcentaje (planning.md, HU-13 y HU-15). Sin
 * imagen muestra un marcador visual y no una imagen rota.
 */
export function ProductCard({
  title,
  href,
  imageUrl,
  imageAlt,
  listPrice,
  currencyCode,
  transferPercent = 0,
  soldOut = false,
}: ProductCardProps) {
  const transfer = transferPrice(listPrice, transferPercent)
  const hasTransfer = transfer < listPrice

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md focus-within:shadow-md">
      <Link href={href} className="flex flex-col focus-visible:outline-2 focus-visible:outline-ink">
        <div className="relative aspect-[4/5] bg-canvas">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? title}
              fill
              sizes="(min-width: 768px) 25vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label={`${title}, sin imagen`}
              className="flex h-full items-center justify-center text-shade-40"
            >
              <ImageSquare size={48} weight="light" aria-hidden="true" />
            </div>
          )}
          {soldOut && (
            <Badge variant="neutral" className="absolute left-3 top-3">
              Agotado
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <h3 className="text-base text-ink">{title}</h3>
          <p className="text-lg text-ink">{formatPrice(listPrice, currencyCode)}</p>
          {hasTransfer && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-shade-60">
              <Badge>{`-${transferPercent}% por transferencia`}</Badge>
              <span className="text-ink">{formatPrice(transfer, currencyCode)}</span>
            </p>
          )}
        </div>
      </Link>
    </Card>
  )
}
