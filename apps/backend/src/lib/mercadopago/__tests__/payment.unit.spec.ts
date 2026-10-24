import { evaluatePayment, mapStatus } from "../payment"

const expected = { amount: 1800, currency: "ARS", reference: "payses_01ABC" }
const approved = { id: 555, status: "approved", transaction_amount: 1800, currency_id: "ARS", external_reference: "payses_01ABC" }

describe("mapStatus", () => {
  it("agrupa los estados de Mercado Pago", () => {
    expect(mapStatus("approved")).toBe("approved")
    for (const s of ["pending", "in_process", "authorized"]) expect(mapStatus(s)).toBe("pending")
    for (const s of ["rejected", "cancelled"]) expect(mapStatus(s)).toBe("rejected")
    for (const s of ["refunded", "charged_back"]) expect(mapStatus(s)).toBe("refunded")
    expect(mapStatus("algo_nuevo")).toBe("pending")
    expect(mapStatus(undefined)).toBe("pending")
  })
})

describe("evaluatePayment (SEC-32, HU-25)", () => {
  it("un pago aprobado con monto, moneda y referencia correctos se acepta", () => {
    expect(evaluatePayment(approved, expected)).toEqual({ state: "approved", problem: null })
  })

  it("un monto distinto no se marca como cobrado y se informa PAYMENT_AMOUNT_MISMATCH", () => {
    expect(evaluatePayment({ ...approved, transaction_amount: 1 }, expected)).toEqual({ state: "approved", problem: "PAYMENT_AMOUNT_MISMATCH" })
  })

  it("una moneda o una referencia distintas también son un problema", () => {
    expect(evaluatePayment({ ...approved, currency_id: "USD" }, expected).problem).toBe("PAYMENT_AMOUNT_MISMATCH")
    expect(evaluatePayment({ ...approved, external_reference: "otra" }, expected).problem).toBe("PAYMENT_AMOUNT_MISMATCH")
  })

  it("compara el monto con dos decimales, sin errores de punto flotante", () => {
    expect(evaluatePayment({ ...approved, transaction_amount: 1800.004 }, expected).problem).toBeNull()
    expect(evaluatePayment({ ...approved, transaction_amount: 1799.99 }, expected).problem).toBe("PAYMENT_AMOUNT_MISMATCH")
    expect(evaluatePayment({ ...approved, transaction_amount: 0.1 + 0.2 }, { ...expected, amount: 0.3 }).problem).toBeNull()
  })

  it("un pago pendiente o rechazado no tiene problema de monto por sí mismo", () => {
    expect(evaluatePayment({ ...approved, status: "pending" }, expected)).toEqual({ state: "pending", problem: null })
    expect(evaluatePayment({ ...approved, status: "rejected" }, expected)).toEqual({ state: "rejected", problem: null })
  })

  it("datos faltantes o de tipo inesperado no se aceptan", () => {
    expect(evaluatePayment({ ...approved, transaction_amount: "1800" as never }, expected).problem).toBe("PAYMENT_AMOUNT_MISMATCH")
    expect(evaluatePayment({ status: "approved" } as never, expected).problem).toBe("PAYMENT_AMOUNT_MISMATCH")
  })
})
