export type DeliveryKind = "pickup" | "delivery"

export type CheckoutData = {
  firstName: string
  lastName: string
  email: string
  phone: string
  document: string | null
  shippingOptionId: string
  address: { street: string; city: string; province: string; postalCode: string } | null
}

export type CheckoutField =
  | "name"
  | "email"
  | "phone"
  | "document"
  | "shippingOptionId"
  | "street"
  | "city"
  | "province"
  | "postalCode"

export type CheckoutParse =
  | { ok: true; data: CheckoutData }
  | { ok: false; errors: Partial<Record<CheckoutField, string>> }

type Raw = Partial<Record<CheckoutField, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_CHARS = /^[+\d\s().-]+$/
const OPTION_ID = /^[A-Za-z0-9_]{1,100}$/
const POSTAL = /^[A-Za-z0-9 -]{4,10}$/

const clean = (value: string | undefined) => (value ?? "").trim()

/**
 * Valida los datos del invitado y de la entrega (planning.md, HU-19 y HU-20).
 * Devuelve un mensaje por campo para mostrarlo junto a cada uno. La dirección
 * solo se pide y se conserva si la opción elegida es un envío. Toda entrada se
 * valida en el servidor (seguridad.md, SEC-61).
 */
export function parseCheckoutForm(raw: Raw, kind: DeliveryKind): CheckoutParse {
  const errors: Partial<Record<CheckoutField, string>> = {}

  const name = clean(raw.name)
  if (!name) errors.name = "Ingresá tu nombre."
  else if (name.length > 100) errors.name = "El nombre es demasiado largo."

  const email = clean(raw.email)
  if (!email) errors.email = "Ingresá tu email."
  else if (email.length > 254 || !EMAIL.test(email)) errors.email = "Revisá el email: parece incompleto."

  const phone = clean(raw.phone)
  const phoneDigits = phone.replace(/\D/g, "")
  if (!phone) errors.phone = "Ingresá tu teléfono."
  else if (!PHONE_CHARS.test(phone) || phoneDigits.length < 8 || phoneDigits.length > 15) {
    errors.phone = "Revisá el teléfono: usá solo números, con el código de área."
  }

  const documentRaw = clean(raw.document)
  const documentDigits = documentRaw.replace(/[.\-\s]/g, "")
  let document: string | null = null
  if (documentRaw) {
    if (/^\d{7,11}$/.test(documentDigits)) document = documentDigits
    else errors.document = "El documento debe tener entre 7 y 11 números."
  }

  const shippingOptionId = clean(raw.shippingOptionId)
  if (!OPTION_ID.test(shippingOptionId)) errors.shippingOptionId = "Elegí cómo querés recibir tu compra."

  let address: CheckoutData["address"] = null
  if (kind === "delivery") {
    const street = clean(raw.street)
    const city = clean(raw.city)
    const province = clean(raw.province)
    const postalCode = clean(raw.postalCode)
    if (street.length < 3 || street.length > 120) errors.street = "Ingresá la calle y el número."
    if (city.length < 2 || city.length > 80) errors.city = "Ingresá la ciudad."
    if (province.length < 2 || province.length > 80) errors.province = "Ingresá la provincia."
    if (!POSTAL.test(postalCode)) errors.postalCode = "Revisá el código postal."
    address = { street, city, province, postalCode }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const [firstName, ...rest] = name.split(/\s+/)
  return {
    ok: true,
    data: { firstName, lastName: rest.join(" "), email, phone, document, shippingOptionId, address },
  }
}
