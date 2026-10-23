import {
  MANUAL_PROVIDER_ID,
  hasDiscountPaymentMismatch,
  planPaymentMethod,
  scrubSecret,
} from "../guard"

const SECRET = "TRF-9f3k2m8x7q1w"

describe("hasDiscountPaymentMismatch", () => {
  it("rechaza la promoción con un proveedor distinto del manual (tarjeta)", () => {
    expect(
      hasDiscountPaymentMismatch({
        promoCodes: [SECRET],
        secret: SECRET,
        providerIds: ["pp_mercadopago_mercadopago"],
      })
    ).toBe(true)
  })

  it("rechaza si hay una sesión manual y además una de tarjeta", () => {
    expect(
      hasDiscountPaymentMismatch({
        promoCodes: [SECRET],
        secret: SECRET,
        providerIds: [MANUAL_PROVIDER_ID, "pp_mercadopago_mercadopago"],
      })
    ).toBe(true)
  })

  it("acepta la promoción con el proveedor manual", () => {
    expect(
      hasDiscountPaymentMismatch({ promoCodes: [SECRET], secret: SECRET, providerIds: [MANUAL_PROVIDER_ID] })
    ).toBe(false)
  })

  it("sin la promoción, cualquier proveedor es válido", () => {
    expect(
      hasDiscountPaymentMismatch({ promoCodes: ["OTRA"], secret: SECRET, providerIds: ["pp_mercadopago_mercadopago"] })
    ).toBe(false)
  })

  it("el código se compara sin distinguir mayúsculas", () => {
    expect(
      hasDiscountPaymentMismatch({
        promoCodes: [SECRET.toLowerCase()],
        secret: SECRET,
        providerIds: ["pp_mercadopago_mercadopago"],
      })
    ).toBe(true)
  })

  it("si no hay código configurado no hay nada que proteger", () => {
    expect(hasDiscountPaymentMismatch({ promoCodes: [SECRET], secret: null, providerIds: ["x"] })).toBe(false)
  })
})

describe("planPaymentMethod", () => {
  it("transferencia aplica la promoción si no estaba", () => {
    expect(planPaymentMethod("transfer", false)).toBe("apply")
  })
  it("transferencia con la promoción ya aplicada no hace nada", () => {
    expect(planPaymentMethod("transfer", true)).toBe("none")
  })
  it("tarjeta quita la promoción si estaba", () => {
    expect(planPaymentMethod("card", true)).toBe("remove")
  })
  it("tarjeta sin promoción no hace nada", () => {
    expect(planPaymentMethod("card", false)).toBe("none")
  })
})

describe("scrubSecret", () => {
  it("reemplaza el código en cualquier nivel de la respuesta", () => {
    const body = {
      cart: {
        promotions: [{ id: "promo_1", code: SECRET }],
        items: [{ adjustments: [{ code: SECRET, amount: 100 }] }],
        metadata: { note: `usó ${SECRET} hoy` },
      },
    }
    const scrubbed = JSON.stringify(scrubSecret(body, SECRET))
    expect(scrubbed).not.toContain(SECRET)
    expect(scrubbed).toContain("promo_1")
    expect(scrubbed).toContain("100")
  })

  it("no distingue mayúsculas y no toca el original", () => {
    const body = { code: SECRET.toLowerCase() }
    expect(JSON.stringify(scrubSecret(body, SECRET))).not.toContain(SECRET.toLowerCase())
    expect(body.code).toBe(SECRET.toLowerCase())
  })

  it("deja pasar valores que no son objetos y respeta números, null y arreglos", () => {
    expect(scrubSecret(null, SECRET)).toBeNull()
    expect(scrubSecret(5, SECRET)).toBe(5)
    expect(scrubSecret([1, "a", null], SECRET)).toEqual([1, "a", null])
  })

  it("respeta toJSON: los montos de Medusa (BigNumber) siguen saliendo como números", () => {
    class Money {
      constructor(private readonly value: number) {}
      toJSON() {
        return this.value
      }
    }
    const scrubbed = scrubSecret({ total: new Money(2700), code: SECRET }, SECRET)
    expect(JSON.parse(JSON.stringify(scrubbed))).toEqual({ total: 2700, code: "" })
  })

  it("sin código configurado devuelve la respuesta tal cual", () => {
    const body = { a: 1 }
    expect(scrubSecret(body, null)).toBe(body)
  })
})
