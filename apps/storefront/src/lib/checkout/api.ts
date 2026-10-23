import { cartFetch } from "../cart/api"
import type { DeliveryKind } from "./schema"

export type ShippingChoice = {
  id: string
  name: string
  kind: DeliveryKind
  /** Costo fijo calculado por Medusa, en la unidad de la moneda. */
  amount: number
}

type RawOption = {
  id: string
  name: string
  amount?: number | null
  type?: { code?: string | null } | null
}

/** Opciones de entrega del carrito, las nativas de Medusa (planning.md, HU-20). */
export async function getShippingChoices(cartId: string): Promise<ShippingChoice[]> {
  const result = await cartFetch<{ shipping_options: RawOption[] }>(
    `/store/shipping-options?cart_id=${encodeURIComponent(cartId)}&fields=${encodeURIComponent("+type.code")}`
  )
  if (!result.ok) return []
  return result.body.shipping_options.map((option) => ({
    id: option.id,
    name: option.name,
    kind: option.type?.code === "delivery" ? "delivery" : "pickup",
    amount: option.amount ?? 0,
  }))
}
