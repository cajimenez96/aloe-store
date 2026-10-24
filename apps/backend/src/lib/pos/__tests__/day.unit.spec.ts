import { dayBounds, summarizeSales } from "../day"

describe("dayBounds (hora de Argentina, UTC-3)", () => {
  it("el día va de las 00:00 a las 24:00 de Argentina", () => {
    const { from, to } = dayBounds("2026-10-24")!
    expect(from.toISOString()).toBe("2026-10-24T03:00:00.000Z")
    expect(to.toISOString()).toBe("2026-10-25T03:00:00.000Z")
  })

  it("rechaza fechas inválidas", () => {
    for (const bad of ["", "24/10/2026", "2026-13-01", "2026-02-30", "hoy", "2026-10-24; drop"]) {
      expect(dayBounds(bad)).toBeNull()
    }
  })

  it("sin fecha usa el día de hoy en Argentina", () => {
    const at = new Date("2026-10-25T01:30:00Z") // 22:30 del 24 en Argentina
    expect(dayBounds(undefined, at)?.from.toISOString()).toBe("2026-10-24T03:00:00.000Z")
  })
})

describe("summarizeSales (HU-37)", () => {
  const sales = [
    { displayId: 1, total: 1500, method: "cash", at: new Date("2026-10-24T15:00:00Z"), user: "vend@x.com" },
    { displayId: 2, total: 2000, method: "cash", at: new Date("2026-10-24T16:00:00Z"), user: "vend@x.com" },
    { displayId: 3, total: 3000, method: "card", at: new Date("2026-10-24T17:00:00Z"), user: "admin@x.com" },
    { displayId: 4, total: 500, method: "transfer", at: new Date("2026-10-24T18:00:00Z"), user: null },
  ]

  it("suma por medio de pago y el total del día", () => {
    expect(summarizeSales(sales)).toMatchObject({
      totals: { cash: 3500, transfer: 500, card: 3000 },
      total: 7000,
      count: 4,
    })
  })

  it("sin ventas todo es cero", () => {
    expect(summarizeSales([])).toEqual({ totals: { cash: 0, transfer: 0, card: 0 }, total: 0, count: 0 })
  })

  it("un medio desconocido no rompe la suma por medio pero sí cuenta en el total", () => {
    const result = summarizeSales([{ displayId: 9, total: 100, method: "otro", at: new Date(), user: null }])
    expect(result.total).toBe(100)
    expect(result.totals).toEqual({ cash: 0, transfer: 0, card: 0 })
  })
})
