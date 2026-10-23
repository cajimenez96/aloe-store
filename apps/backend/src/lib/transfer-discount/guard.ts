/** Proveedor de pago manual de Medusa: es el que se usa para la transferencia. */
export const MANUAL_PROVIDER_ID = "pp_system_default"

export type PaymentMethod = "card" | "transfer"

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * La promoción de transferencia solo puede convivir con el proveedor manual
 * (seguridad.md, SEC-31). Si el carrito la tiene y alguna sesión de pago es de
 * otro proveedor, el pedido no se puede completar. Es la defensa que queda aunque
 * el código se filtre y alguien lo aplique por su cuenta.
 */
export function hasDiscountPaymentMismatch(input: {
  promoCodes: string[]
  secret: string | null
  providerIds: string[]
}): boolean {
  if (!input.secret) return false
  const applied = input.promoCodes.some((code) => same(code, input.secret as string))
  return applied && input.providerIds.some((id) => id !== MANUAL_PROVIDER_ID)
}

/** Qué hacer con la promoción al elegir el medio de pago (arquitectura.md, sección 14.1). */
export function planPaymentMethod(method: PaymentMethod, promoApplied: boolean): "apply" | "remove" | "none" {
  if (method === "transfer") return promoApplied ? "none" : "apply"
  return promoApplied ? "remove" : "none"
}

/**
 * Reemplaza el código secreto por una cadena vacía en toda la respuesta, sin
 * tocar el original. Medusa devuelve `promotions.code` y `adjustments.code` en el
 * carrito, y el código nunca debe salir por la API de tienda (SEC-31).
 */
export function scrubSecret<T>(value: T, secret: string | null): T {
  if (!secret) return value
  const lower = secret.toLowerCase()

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const index = node.toLowerCase().indexOf(lower)
      if (index === -1) return node
      let out = node
      let at = out.toLowerCase().indexOf(lower)
      while (at !== -1) {
        out = out.slice(0, at) + out.slice(at + secret.length)
        at = out.toLowerCase().indexOf(lower)
      }
      return out
    }
    if (node && typeof node === "object" && typeof (node as { toJSON?: unknown }).toJSON === "function") {
      return walk((node as { toJSON: () => unknown }).toJSON())
    }
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]))
    }
    return node
  }

  return walk(value) as T
}
