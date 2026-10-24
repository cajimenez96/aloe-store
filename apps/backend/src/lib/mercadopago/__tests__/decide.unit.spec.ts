import { decideSettlement, pickPayment } from "../decide"

const session = { id: "payses_01ABC", amount: 1800, currency: "ARS", done: false }
const approved = { id: 555, status: "approved", transaction_amount: 1800, currency_id: "ARS", external_reference: "payses_01ABC" }

describe("decideSettlement (HU-25, HU-26)", () => {
  it("un pago aprobado y correcto se captura", () => {
    expect(decideSettlement({ session, payment: approved })).toEqual({ action: "capture", paymentId: "555" })
  })

  it("la misma notificación procesada dos veces no vuelve a capturar", () => {
    expect(decideSettlement({ session: { ...session, done: true }, payment: approved })).toEqual({ action: "noop" })
  })

  it("un monto, moneda o referencia distintos no se capturan", () => {
    expect(decideSettlement({ session, payment: { ...approved, transaction_amount: 1700 } })).toEqual({ action: "mismatch", problem: "PAYMENT_AMOUNT_MISMATCH" })
    expect(decideSettlement({ session, payment: { ...approved, external_reference: "otra" } }).action).toBe("mismatch")
  })

  it("un mismatch tampoco se captura aunque la sesión ya figure como hecha", () => {
    expect(decideSettlement({ session: { ...session, done: true }, payment: { ...approved, transaction_amount: 1 } }).action).toBe("noop")
  })

  it("pendiente, rechazado y reembolsado se informan sin capturar", () => {
    expect(decideSettlement({ session, payment: { ...approved, status: "in_process" } })).toEqual({ action: "pending" })
    expect(decideSettlement({ session, payment: { ...approved, status: "rejected" } })).toEqual({ action: "rejected" })
    expect(decideSettlement({ session, payment: { ...approved, status: "refunded" } })).toEqual({ action: "refunded" })
  })

  it("sin pago todavía queda pendiente", () => {
    expect(decideSettlement({ session, payment: null })).toEqual({ action: "pending" })
  })
})

describe("pickPayment", () => {
  const pay = (id: number, status: string) => ({ id, status })

  it("prefiere un pago aprobado sobre los demás", () => {
    expect(pickPayment([pay(3, "rejected"), pay(2, "approved"), pay(1, "pending")])?.id).toBe(2)
  })

  it("sin aprobados toma el más nuevo (la lista viene del más nuevo al más viejo)", () => {
    expect(pickPayment([pay(3, "rejected"), pay(2, "rejected")])?.id).toBe(3)
  })

  it("sin pagos devuelve null", () => {
    expect(pickPayment([])).toBeNull()
  })
})
