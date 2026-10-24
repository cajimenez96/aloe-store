import { PAYMENT_GROUPS, buildOrdersQuery, paymentGroupOf } from "../orders-filter"

describe("grupos de estado de pago (HU-32)", () => {
  it("agrupa los estados de Medusa en cuatro grupos que entiende el dueño", () => {
    expect(Object.keys(PAYMENT_GROUPS)).toEqual(["unpaid", "paid", "refunded", "canceled"])
    expect(PAYMENT_GROUPS.paid.statuses).toEqual(["captured", "partially_captured"])
    expect(PAYMENT_GROUPS.unpaid.statuses).toEqual(expect.arrayContaining(["not_paid", "awaiting", "authorized"]))
  })

  it("cada estado de pago pertenece a un solo grupo", () => {
    const all = Object.values(PAYMENT_GROUPS).flatMap((group) => group.statuses)
    expect(new Set(all).size).toBe(all.length)
  })

  it("paymentGroupOf devuelve la etiqueta del grupo o el estado crudo si no se conoce", () => {
    expect(paymentGroupOf("captured")).toBe("Pagado")
    expect(paymentGroupOf("authorized")).toBe("Sin pagar")
    expect(paymentGroupOf("estado_nuevo")).toBe("estado_nuevo")
  })
})

describe("buildOrdersQuery", () => {
  it("sin filtros pide la primera página", () => {
    const query = buildOrdersQuery({ channelId: "", group: "", offset: 0 })
    expect(query).toBe("limit=25&offset=0")
  })

  it("filtra por canal y por grupo de estado de pago", () => {
    const query = buildOrdersQuery({ channelId: "sc_1", group: "paid", offset: 25 })
    expect(query).toContain("sales_channel_id=sc_1")
    expect(query).toContain("payment_group=paid")
    expect(query).toContain("offset=25")
  })

  it("un grupo desconocido no agrega filtro de pago", () => {
    expect(buildOrdersQuery({ channelId: "", group: "inventado", offset: 0 })).not.toContain("payment_group")
  })
})
