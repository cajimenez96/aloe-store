export type PreferenceInput = {
  reference: string
  title: string
  total: number
  currency: string
  /** Opcional: sin URL pública la preferencia se crea sin ella (arquitectura.md, sección 10.4). */
  notificationUrl?: string
  /** Opcional: base de la URL a la que vuelve el cliente. */
  backUrlBase?: string
}

export type Preference = {
  external_reference: string
  items: { title: string; quantity: number; unit_price: number; currency_id: string }[]
  notification_url?: string
  back_urls?: { success: string; pending: string; failure: string }
  auto_return?: "approved"
}

const httpUrl = (value: string | undefined): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Preferencia de Checkout Pro (planning.md, HU-24). Lleva un solo ítem con el total
 * que calculó Medusa (descuentos y envío incluidos) y una referencia externa propia.
 */
export function buildPreference(input: PreferenceInput): Preference {
  if (!Number.isFinite(input.total) || input.total <= 0) {
    throw new Error("El total de la preferencia debe ser un número positivo.")
  }
  const preference: Preference = {
    external_reference: input.reference,
    items: [
      {
        title: input.title,
        quantity: 1,
        unit_price: Math.round(input.total * 100) / 100,
        currency_id: input.currency.toUpperCase(),
      },
    ],
  }
  const notification = httpUrl(input.notificationUrl)
  if (notification) preference.notification_url = notification
  const back = httpUrl(input.backUrlBase)
  if (back) {
    preference.back_urls = { success: back, pending: back, failure: back }
    preference.auto_return = "approved"
  }
  return preference
}
