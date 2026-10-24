import { parseSaleInput } from "../sale"

const valid = {
  items: [{ variant_id: "variant_01ABC", quantity: 2 }],
  payment_method: "cash",
}

describe("parseSaleInput (HU-34)", () => {
  it("acepta una venta con ítems y medio de pago", () => {
    expect(parseSaleInput(valid)).toEqual({
      ok: true,
      data: {
        items: [{ variantId: "variant_01ABC", quantity: 2 }],
        paymentMethod: "cash",
        customerName: null,
        customerDocument: null,
        note: null,
      },
    })
  })

  it("una venta vacía devuelve SALE_ITEMS_EMPTY", () => {
    for (const body of [{ ...valid, items: [] }, { payment_method: "cash" }, { ...valid, items: null }]) {
      expect(parseSaleInput(body)).toMatchObject({ ok: false, code: "SALE_ITEMS_EMPTY" })
    }
  })

  it("acepta los tres medios de pago y rechaza otros", () => {
    for (const method of ["cash", "transfer", "card"]) {
      expect(parseSaleInput({ ...valid, payment_method: method }).ok).toBe(true)
    }
    for (const method of ["bitcoin", "", undefined, 5]) {
      expect(parseSaleInput({ ...valid, payment_method: method })).toMatchObject({ ok: false, code: "SALE_INVALID" })
    }
  })

  it("rechaza cantidades y variantes inválidas", () => {
    for (const item of [
      { variant_id: "variant_1", quantity: 0 },
      { variant_id: "variant_1", quantity: -1 },
      { variant_id: "variant_1", quantity: 1.5 },
      { variant_id: "variant_1", quantity: 1000 },
      { variant_id: "../x", quantity: 1 },
      { quantity: 1 },
    ]) {
      expect(parseSaleInput({ ...valid, items: [item] })).toMatchObject({ ok: false, code: "SALE_INVALID" })
    }
  })

  it("junta las cantidades de una misma variante repetida", () => {
    const result = parseSaleInput({
      ...valid,
      items: [
        { variant_id: "variant_1", quantity: 1 },
        { variant_id: "variant_1", quantity: 2 },
        { variant_id: "variant_2", quantity: 1 },
      ],
    })
    expect(result.ok && result.data.items).toEqual([
      { variantId: "variant_1", quantity: 3 },
      { variantId: "variant_2", quantity: 1 },
    ])
  })

  it("cliente y nota son opcionales, se recortan y tienen largo máximo", () => {
    const result = parseSaleInput({ ...valid, customer: { name: "  Ana Pérez ", document: "30.123.456" }, note: " entrega rápida " })
    expect(result).toMatchObject({
      ok: true,
      data: { customerName: "Ana Pérez", customerDocument: "30123456", note: "entrega rápida" },
    })
    expect(parseSaleInput({ ...valid, note: "x".repeat(301) })).toMatchObject({ ok: false, code: "SALE_INVALID" })
    expect(parseSaleInput({ ...valid, customer: { name: "x".repeat(101) } })).toMatchObject({ ok: false })
    expect(parseSaleInput({ ...valid, customer: { document: "12" } })).toMatchObject({ ok: false })
  })

  it("no acepta más de 50 renglones", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ variant_id: `variant_${i}`, quantity: 1 }))
    expect(parseSaleInput({ ...valid, items })).toMatchObject({ ok: false, code: "SALE_INVALID" })
  })

  it("ignora campos de precio que alguien intente mandar (SEC-30)", () => {
    const result = parseSaleInput({ ...valid, items: [{ variant_id: "variant_1", quantity: 1, unit_price: 1 }], total: 1 })
    expect(result.ok && result.data.items).toEqual([{ variantId: "variant_1", quantity: 1 }])
  })
})
