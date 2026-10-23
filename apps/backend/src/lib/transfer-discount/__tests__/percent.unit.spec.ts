import { pickTransferPercent } from "../percent"

const NOW = new Date("2026-10-23T12:00:00Z")

const promo = (overrides: Record<string, unknown> = {}) => ({
  status: "active",
  application_method: { type: "percentage", target_type: "order", value: 10 },
  campaign: null,
  ...overrides,
})

describe("pickTransferPercent", () => {
  it("devuelve el porcentaje de una promoción activa de porcentaje sobre el pedido", () => {
    expect(pickTransferPercent(promo(), NOW)).toBe(10)
    expect(
      pickTransferPercent(
        promo({ application_method: { type: "percentage", target_type: "order", value: 7.5 } }),
        NOW
      )
    ).toBe(7.5)
  })

  it("devuelve 0 si no hay promoción", () => {
    expect(pickTransferPercent(null, NOW)).toBe(0)
    expect(pickTransferPercent(undefined, NOW)).toBe(0)
  })

  it("devuelve 0 si la promoción no está activa", () => {
    expect(pickTransferPercent(promo({ status: "draft" }), NOW)).toBe(0)
    expect(pickTransferPercent(promo({ status: "inactive" }), NOW)).toBe(0)
  })

  it("devuelve 0 si no es un porcentaje sobre el pedido", () => {
    expect(
      pickTransferPercent(
        promo({ application_method: { type: "fixed", target_type: "order", value: 500 } }),
        NOW
      )
    ).toBe(0)
    expect(
      pickTransferPercent(
        promo({ application_method: { type: "percentage", target_type: "items", value: 10 } }),
        NOW
      )
    ).toBe(0)
    expect(pickTransferPercent(promo({ application_method: null }), NOW)).toBe(0)
  })

  it("devuelve 0 si el porcentaje es inválido", () => {
    for (const value of [0, -5, 101, Number.NaN, "10", null]) {
      expect(
        pickTransferPercent(
          promo({ application_method: { type: "percentage", target_type: "order", value } }),
          NOW
        )
      ).toBe(0)
    }
  })

  it("respeta las fechas de la campaña", () => {
    const campaign = (starts_at: string | null, ends_at: string | null) =>
      promo({ campaign: { starts_at, ends_at } })
    expect(pickTransferPercent(campaign("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"), NOW)).toBe(10)
    expect(pickTransferPercent(campaign("2026-11-01T00:00:00Z", null), NOW)).toBe(0)
    expect(pickTransferPercent(campaign(null, "2026-10-01T00:00:00Z"), NOW)).toBe(0)
    expect(pickTransferPercent(campaign(null, null), NOW)).toBe(10)
  })
})
