import { describe, expect, it } from "vitest"
import { confirmBlocker } from "../blocker"

const ready = { email: "ana@ejemplo.com", hasShippingMethod: true, hasAddressName: true, method: "transfer" as const }

describe("confirmBlocker", () => {
  it("con todo listo y transferencia se puede confirmar", () => {
    expect(confirmBlocker(ready)).toBeNull()
  })

  it("sin medio de pago no se puede confirmar", () => {
    expect(confirmBlocker({ ...ready, method: null })).toMatch(/cómo querés pagar/i)
  })

  it("con tarjeta y los datos guardados se puede pagar", () => {
    expect(confirmBlocker({ ...ready, method: "card" })).toBeNull()
  })

  it("con tarjeta también hacen falta los datos y la entrega", () => {
    expect(confirmBlocker({ ...ready, method: "card", email: "" })).toMatch(/guardá tus datos/i)
  })

  it("sin datos o sin forma de entrega guardados pide guardarlos", () => {
    for (const missing of [{ email: "" }, { hasShippingMethod: false }, { hasAddressName: false }]) {
      expect(confirmBlocker({ ...ready, ...missing })).toMatch(/guardá tus datos/i)
    }
  })
})
