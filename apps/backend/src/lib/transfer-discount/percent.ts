type PromotionLike = {
  status?: string | null
  application_method?: {
    type?: string | null
    target_type?: string | null
    value?: unknown
  } | null
  campaign?: { starts_at?: string | Date | null; ends_at?: string | Date | null } | null
}

/**
 * Porcentaje de descuento por transferencia a partir de la promoción de Medusa,
 * que es la única fuente de ese valor (arquitectura.md, sección 6). Devuelve 0 si
 * la promoción no existe, no está activa, no es un porcentaje sobre el pedido o
 * está fuera de las fechas de su campaña. Solo sirve para mostrar el precio: lo
 * que se cobra siempre lo calcula Medusa (seguridad.md, SEC-30).
 */
export function pickTransferPercent(
  promotion: PromotionLike | null | undefined,
  now: Date = new Date()
): number {
  if (!promotion || promotion.status !== "active") {
    return 0
  }

  const method = promotion.application_method
  if (!method || method.type !== "percentage" || method.target_type !== "order") {
    return 0
  }

  const value = method.value
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    return 0
  }

  const starts = promotion.campaign?.starts_at
  const ends = promotion.campaign?.ends_at
  if (starts && new Date(starts) > now) {
    return 0
  }
  if (ends && new Date(ends) < now) {
    return 0
  }

  return value
}
