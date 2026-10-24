import { pageOrders } from "../list"

const order = (n: number, paymentStatus: string) => ({ id: `order_${n}`, payment_status: paymentStatus })

describe("pageOrders (HU-32)", () => {
  const orders = [
    order(1, "captured"),
    order(2, "authorized"),
    order(3, "captured"),
    order(4, "not_paid"),
    order(5, "refunded"),
    order(6, "canceled"),
    order(7, "partially_refunded"),
  ]

  it("sin grupo devuelve todo", () => {
    expect(pageOrders({ orders, group: "", offset: 0, limit: 25 })).toMatchObject({ count: 7 })
  })

  it("filtra por el grupo de estado de pago", () => {
    expect(pageOrders({ orders, group: "paid", offset: 0, limit: 25 }).orders.map((o) => o.id)).toEqual(["order_1", "order_3"])
    expect(pageOrders({ orders, group: "unpaid", offset: 0, limit: 25 }).orders.map((o) => o.id)).toEqual(["order_2", "order_4"])
    expect(pageOrders({ orders, group: "refunded", offset: 0, limit: 25 }).orders.map((o) => o.id)).toEqual(["order_5", "order_7"])
    expect(pageOrders({ orders, group: "canceled", offset: 0, limit: 25 }).orders.map((o) => o.id)).toEqual(["order_6"])
  })

  it("el total refleja el filtro y la paginación recorta la página", () => {
    const page = pageOrders({ orders, group: "paid", offset: 1, limit: 1 })
    expect(page.count).toBe(2)
    expect(page.orders.map((o) => o.id)).toEqual(["order_3"])
  })

  it("un grupo desconocido no filtra por pago", () => {
    expect(pageOrders({ orders, group: "inventado", offset: 0, limit: 25 }).count).toBe(7)
  })

  it("un offset más allá del final devuelve una página vacía", () => {
    expect(pageOrders({ orders, group: "", offset: 100, limit: 25 })).toMatchObject({ count: 7, orders: [] })
  })
})
