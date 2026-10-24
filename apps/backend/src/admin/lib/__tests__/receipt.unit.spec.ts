import { buildReceiptHtml, paymentLabel } from "../receipt"

const sale = {
  display_id: 42,
  total: 5500,
  currency_code: "ars",
  payment_method: "cash",
  created_at: "2026-10-24T18:30:00.000Z",
  items: [
    { title: "Pijama", variant_title: "M", quantity: 2, unit_price: 2000, total: 4000 },
    { title: "Corpiño", variant_title: null, quantity: 1, unit_price: 1500, total: 1500 },
  ],
}

describe("comprobante no fiscal (HU-36)", () => {
  const html = buildReceiptHtml(sale, "Aloe")

  it("dice que es un documento no fiscal", () => {
    expect(html).toContain("Documento no fiscal")
  })

  it("incluye número de venta, ítems, total, medio de pago y fecha", () => {
    expect(html).toContain("#42")
    expect(html).toContain("2 × Pijama (M)")
    expect(html).toContain("1 × Corpiño")
    expect(html).toContain("Efectivo")
    expect(html).toMatch(/\$\s?5\.500/)
    expect(html).toMatch(/24\/10\/2026/)
  })

  it("es un documento completo y escapa los datos", () => {
    expect(html).toMatch(/^<!doctype html>/i)
    const hostile = buildReceiptHtml(
      { ...sale, items: [{ title: "<script>alert(1)</script>", variant_title: '"><img src=x>', quantity: 1, unit_price: 1, total: 1 }] },
      "<b>Aloe</b>"
    )
    expect(hostile).not.toContain("<script>alert(1)</script>")
    expect(hostile).not.toContain("<img src=x>")
    expect(hostile).not.toContain("<b>Aloe</b>")
  })

  it("nombra los tres medios de pago", () => {
    expect(paymentLabel("cash")).toBe("Efectivo")
    expect(paymentLabel("transfer")).toBe("Transferencia")
    expect(paymentLabel("card")).toBe("Tarjeta")
    expect(paymentLabel("otro")).toBe("otro")
  })
})
