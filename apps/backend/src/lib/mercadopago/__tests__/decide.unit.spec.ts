import { decideSettlement, isDuplicateApproval, isOurReference, pickPayment } from "../decide"

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
  const expected = { amount: 2000, currency: "ARS", reference: "payses_01ABC" }
  const pay = (id: number, status: string, amount = 2000) => ({
    id,
    status,
    transaction_amount: amount,
    currency_id: "ARS",
    external_reference: "payses_01ABC",
  })

  it("prefiere un pago aprobado que coincide con lo esperado", () => {
    expect(pickPayment([pay(3, "rejected"), pay(2, "approved"), pay(1, "pending")], expected)?.id).toBe(2)
  })

  it("entre varios aprobados toma el correcto aunque haya uno más nuevo con otro monto", () => {
    expect(pickPayment([pay(4, "approved", 1), pay(3, "approved", 2000)], expected)?.id).toBe(3)
  })

  it("si el aprobado no coincide igual lo devuelve, para informar el desajuste", () => {
    expect(pickPayment([pay(4, "approved", 1)], expected)?.id).toBe(4)
  })

  it("sin aprobados toma el más nuevo (la lista viene del más nuevo al más viejo)", () => {
    expect(pickPayment([pay(3, "rejected"), pay(2, "rejected")], expected)?.id).toBe(3)
  })

  it("sin pagos devuelve null", () => {
    expect(pickPayment([], expected)).toBeNull()
  })
})

describe("isDuplicateApproval (HU-25)", () => {
  const approved = { id: 777, status: "approved", transaction_amount: 2000, currency_id: "ARS", external_reference: "payses_01ABC" }

  it("un segundo pago aprobado con otro id, cuando ya se cobró uno, es un duplicado a devolver", () => {
    expect(isDuplicateApproval({ payment: approved, capturedPaymentId: "555" })).toBe(true)
  })

  it("el mismo pago que ya se cobró no es un duplicado", () => {
    expect(isDuplicateApproval({ payment: approved, capturedPaymentId: "777" })).toBe(false)
  })

  it("si no se sabe cuál se cobró, o el pago no está aprobado, no se devuelve nada", () => {
    expect(isDuplicateApproval({ payment: approved, capturedPaymentId: null })).toBe(false)
    expect(isDuplicateApproval({ payment: { ...approved, status: "rejected" }, capturedPaymentId: "555" })).toBe(false)
  })
})

describe("isOurReference", () => {
  it("solo reconoce las referencias que arma esta tienda (id de sesión de pago)", () => {
    expect(isOurReference("payses_01M5QRRA1VBSWSBW9ZM51AF53P")).toBe(true)
    for (const other of ["", "orden-123", "payses_", "payses_../x", "PAYSES_01", null, undefined]) {
      expect(isOurReference(other as never)).toBe(false)
    }
  })
})
