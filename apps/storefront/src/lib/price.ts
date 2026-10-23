/**
 * Formatea un monto en la unidad de la moneda (no en centavos, sp-01-medusa.md
 * punto 4). Sin decimales si el monto es entero y con dos si tiene centavos,
 * porque Medusa calcula el precio por transferencia sin redondear
 * (producto.md, sección 8.1).
 */
export function formatPrice(amount: number, currencyCode: string): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount)
}

/**
 * Precio por transferencia a partir del precio de lista, solo para mostrarlo.
 * El valor que se cobra siempre lo calcula Medusa (seguridad.md, SEC-30).
 * Un porcentaje fuera de 0 a 100 no se aplica.
 */
export function transferPrice(listPrice: number, discountPercent: number): number {
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return listPrice
  }
  return listPrice * (1 - discountPercent / 100)
}
