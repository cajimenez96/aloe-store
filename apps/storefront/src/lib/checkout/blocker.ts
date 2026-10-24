type Input = {
  email: string | null | undefined
  hasShippingMethod: boolean
  hasAddressName: boolean
  method: "card" | "transfer" | null
}

/**
 * Qué falta para confirmar el pedido, o null si se puede (planning.md, HU-21:
 * "No se puede confirmar sin medio de pago elegido"). El backend vuelve a validar
 * todo al confirmar; esto solo evita un botón que no va a funcionar.
 */
export function confirmBlocker(input: Input): string | null {
  if (!input.email || !input.hasShippingMethod || !input.hasAddressName) {
    return "Guardá tus datos y la forma de entrega para poder confirmar."
  }
  if (!input.method) return "Elegí cómo querés pagar para confirmar el pedido."
  if (input.method === "card") {
    return "El pago con tarjeta todavía no está disponible. Elegí transferencia."
  }
  return null
}
