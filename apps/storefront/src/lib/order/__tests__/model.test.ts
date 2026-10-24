import { describe, expect, it } from "vitest"
import { buildOrderView, isOrderId, isOrderToken, orderCookieName } from "../model"

const detail = {
  order: {
    id: "order_01ABC",
    display_id: 42,
    status: "pending",
    currency_code: "ars",
    created_at: "2026-10-24T15:00:00.000Z",
    customer_first_name: "Ana",
    items: [{ title: "Pijama", variant_title: "M", quantity: 2, unit_price: 2000, total: 3600 }],
    shipping: { name: "Retiro en el local" },
    subtotal: 4000,
    discount_total: 400,
    total: 3600,
  },
  payment: {
    method: "transfer",
    reference: "PED-42",
    due_at: "2026-10-25T15:00:00.000Z",
    bank_account: { holder: "Aloe SRL", cbu: "0170099220000067797370", alias: "aloe.tienda", bank: "Banco Ejemplo" },
  },
}

describe("buildOrderView", () => {
  it("arma el pedido con el monto exacto que calculó Medusa", () => {
    const view = buildOrderView(detail)
    expect(view).toMatchObject({
      number: 42,
      firstName: "Ana",
      total: 3600,
      discount: 400,
      currencyCode: "ars",
      shippingName: "Retiro en el local",
      paymentMethod: "transfer",
    })
    expect(view.items).toEqual([
      { title: "Pijama", variantTitle: "M", quantity: 2, unitPrice: 2000, total: 3600 },
    ])
  })

  it("con transferencia pendiente trae los datos para pagar", () => {
    expect(buildOrderView(detail).transfer).toEqual({
      reference: "PED-42",
      dueAt: new Date("2026-10-25T15:00:00.000Z"),
      bank: { holder: "Aloe SRL", cbu: "0170099220000067797370", alias: "aloe.tienda", bank: "Banco Ejemplo" },
    })
  })

  it("sin cuenta bancaria (pedido ya pagado o cancelado) no hay datos para pagar", () => {
    const paid = buildOrderView({ ...detail, payment: { ...detail.payment, bank_account: null, due_at: null } })
    expect(paid.transfer).toBeNull()
  })

  it("un pedido pagado no muestra datos para pagar y figura como pagado", () => {
    const paid = buildOrderView({ ...detail, payment: { ...detail.payment, status: "paid", due_at: null } })
    expect(paid.paid).toBe(true)
    expect(paid.transfer).toBeNull()
    expect(buildOrderView(detail).paid).toBe(false)
  })

  it("con tarjeta no hay datos de transferencia", () => {
    const card = buildOrderView({ ...detail, payment: { method: "card", reference: null, due_at: null, bank_account: null } })
    expect(card.paymentMethod).toBe("card")
    expect(card.transfer).toBeNull()
  })
})

describe("formato de id y token", () => {
  it("acepta ids de pedido y tokens con la forma esperada", () => {
    expect(isOrderId("order_01M5QHVT2PBT5VAFHAVQQFXJFX")).toBe(true)
    expect(isOrderToken("a".repeat(43))).toBe(true)
    expect(isOrderToken("Ab-_".repeat(11))).toBe(true)
  })

  it("rechaza lo que no tiene la forma (no llega al backend)", () => {
    for (const bad of ["", "../admin", "order id", "order_01;drop", "x".repeat(200)]) {
      expect(isOrderId(bad), bad).toBe(false)
    }
    for (const bad of ["", "corto", "a".repeat(31), "a".repeat(101), "a b".repeat(20), "<script>".repeat(8)]) {
      expect(isOrderToken(bad), bad).toBe(false)
    }
  })

  it("cada pedido tiene su propia cookie", () => {
    expect(orderCookieName("order_01A")).not.toBe(orderCookieName("order_01B"))
    expect(orderCookieName("order_01A")).toMatch(/^[A-Za-z0-9_]+$/)
  })
})
