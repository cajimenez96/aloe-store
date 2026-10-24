export type PaymentMethod = "cash" | "transfer" | "card"

export type SaleInput = {
  items: { variantId: string; quantity: number }[]
  paymentMethod: PaymentMethod
  customerName: string | null
  customerDocument: string | null
  note: string | null
}

export type SaleParse =
  | { ok: true; data: SaleInput }
  | { ok: false; code: "SALE_ITEMS_EMPTY" | "SALE_INVALID"; message: string }

const METHODS: PaymentMethod[] = ["cash", "transfer", "card"]
const VARIANT_ID = /^[A-Za-z0-9_]{1,100}$/
const invalid = (message: string): SaleParse => ({ ok: false, code: "SALE_INVALID", message })

/**
 * Valida el cuerpo de `POST /admin/pos/sales` (arquitectura.md, sección 14.5).
 * Solo se aceptan variantes y cantidades: el precio lo calcula siempre Medusa
 * (seguridad.md, SEC-30).
 */
export function parseSaleInput(body: unknown): SaleParse {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, code: "SALE_ITEMS_EMPTY", message: "Agregá al menos un producto a la venta." }
  }
  if (input.items.length > 50) return invalid("La venta tiene demasiados renglones.")

  const quantities = new Map<string, number>()
  for (const raw of input.items) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const id = item.variant_id
    const quantity = item.quantity
    if (typeof id !== "string" || !VARIANT_ID.test(id)) return invalid("Hay un producto inválido en la venta.")
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return invalid("Las cantidades deben ser números enteros entre 1 y 99.")
    }
    quantities.set(id, (quantities.get(id) ?? 0) + quantity)
  }
  if ([...quantities.values()].some((quantity) => quantity > 99)) return invalid("La cantidad de un producto supera 99.")

  if (typeof input.payment_method !== "string" || !METHODS.includes(input.payment_method as PaymentMethod)) {
    return invalid("Elegí efectivo, transferencia o tarjeta.")
  }

  const customer = (input.customer && typeof input.customer === "object" ? input.customer : {}) as Record<string, unknown>
  const name = typeof customer.name === "string" ? customer.name.trim() : ""
  if (name.length > 100) return invalid("El nombre del cliente es demasiado largo.")

  const documentRaw = typeof customer.document === "string" ? customer.document.trim() : ""
  const documentDigits = documentRaw.replace(/[.\-\s]/g, "")
  if (documentRaw && !/^\d{7,11}$/.test(documentDigits)) return invalid("El documento debe tener entre 7 y 11 números.")

  const note = typeof input.note === "string" ? input.note.trim() : ""
  if (note.length > 300) return invalid("La nota puede tener hasta 300 caracteres.")

  return {
    ok: true,
    data: {
      items: [...quantities].map(([variantId, quantity]) => ({ variantId, quantity })),
      paymentMethod: input.payment_method as PaymentMethod,
      customerName: name || null,
      customerDocument: documentRaw ? documentDigits : null,
      note: note || null,
    },
  }
}
