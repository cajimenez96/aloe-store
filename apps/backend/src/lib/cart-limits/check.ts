export type CartLimitCode = "MAX_UNITS_EXCEEDED" | "STOCK_INSUFFICIENT" | "VARIANT_UNAVAILABLE"

export class CartLimitError extends Error {
  constructor(
    readonly code: CartLimitCode,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code)
    this.name = "CartLimitError"
  }
}

export type VariantInfo = {
  id: string
  published: boolean
  manageInventory: boolean
  allowBackorder: boolean
  /** Unidades disponibles en el canal; null si no se pudo calcular. */
  available: number | null
}

type Line = { variantId: string; quantity: number }

/**
 * Valida lo que se quiere agregar al carrito contra el máximo por variante
 * (seguridad.md, SEC-40), el stock y la disponibilidad de la variante
 * (planning.md, HU-18). `existing` son las líneas que quedan en el carrito sin
 * contar las que se agregan o cambian, que van en `incoming`. Una variante sin
 * precio la rechaza Medusa por su cuenta al agregarla.
 */
export function checkCartItems(input: {
  maxUnits: number
  existing: Line[]
  incoming: Line[]
  variants: Record<string, VariantInfo>
}): void {
  const totals = new Map<string, number>()
  for (const line of input.existing) {
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity)
  }

  for (const line of input.incoming) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new CartLimitError("VARIANT_UNAVAILABLE", { variant_id: line.variantId })
    }

    const variant = input.variants[line.variantId]
    if (!variant || !variant.published) {
      throw new CartLimitError("VARIANT_UNAVAILABLE", { variant_id: line.variantId })
    }

    const total = (totals.get(line.variantId) ?? 0) + line.quantity
    totals.set(line.variantId, total)

    if (total > input.maxUnits) {
      throw new CartLimitError("MAX_UNITS_EXCEEDED", {
        variant_id: line.variantId,
        max_units_per_variant: input.maxUnits,
      })
    }

    const limited = variant.manageInventory && !variant.allowBackorder
    if (limited && variant.available !== null && total > variant.available) {
      throw new CartLimitError("STOCK_INSUFFICIENT", {
        variant_id: line.variantId,
        available: Math.max(variant.available, 0),
      })
    }
  }
}
