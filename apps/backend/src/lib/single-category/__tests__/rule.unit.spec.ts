import { productsBreakingRule, productsWouldBreakRule } from "../rule"

describe("productsBreakingRule", () => {
  it("marca los productos con más de una categoría", () => {
    const rows = [
      { id: "p1", title: "Corpiño", categories: [{ id: "c1" }, { id: "c2" }] },
      { id: "p2", title: "Pijama", categories: [{ id: "c1" }] },
      { id: "p3", title: "Aros", categories: [] },
    ]
    expect(productsBreakingRule(rows)).toEqual([{ id: "p1", title: "Corpiño" }])
  })

  it("sin categorías o sin datos no marca nada", () => {
    expect(productsBreakingRule([])).toEqual([])
    expect(productsBreakingRule([{ id: "p", title: "x", categories: null }])).toEqual([])
  })
})

describe("productsWouldBreakRule (asignar a una categoría)", () => {
  const rows = [
    { id: "p1", title: "Corpiño", categories: [{ id: "c9" }] },
    { id: "p2", title: "Pijama", categories: [{ id: "c1" }] },
    { id: "p3", title: "Aros", categories: [] },
  ]

  it("rechaza agregar a una categoría un producto que ya está en otra", () => {
    expect(productsWouldBreakRule(rows, "c1")).toEqual([{ id: "p1", title: "Corpiño" }])
  })

  it("acepta productos sin categoría o que ya están en esa misma", () => {
    expect(productsWouldBreakRule(rows.slice(1), "c1")).toEqual([])
  })
})
