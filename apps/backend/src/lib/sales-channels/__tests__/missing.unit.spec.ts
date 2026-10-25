import { productsMissingChannel } from "../missing"

const products = [
  { id: "p1", sales_channels: [{ id: "web" }] },
  { id: "p2", sales_channels: [{ id: "web" }, { id: "local" }] },
  { id: "p3", sales_channels: [] },
  { id: "p4" },
]

describe("productsMissingChannel", () => {
  it("devuelve los productos que todavía no están en el canal", () => {
    expect(productsMissingChannel(products, "local")).toEqual(["p1", "p3", "p4"])
    expect(productsMissingChannel(products, "web")).toEqual(["p3", "p4"])
  })

  it("no devuelve nada si todos ya están", () => {
    expect(productsMissingChannel([products[1]], "local")).toEqual([])
    expect(productsMissingChannel([], "local")).toEqual([])
  })
})
