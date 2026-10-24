import { shouldExpire } from "../expiry"

const now = new Date("2026-10-24T12:00:00Z")
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000)
const base = { status: "pending", method: "transfer", dueAt: hours(-1), proofs: [] as { status: string }[] }

describe("shouldExpire (HU-30)", () => {
  it("cancela un pedido por transferencia vencido y sin comprobantes", () => {
    expect(shouldExpire({ ...base, now })).toBe(true)
  })

  it("no cancela antes del vencimiento", () => {
    expect(shouldExpire({ ...base, dueAt: hours(2), now })).toBe(false)
  })

  it("no cancela si hay un comprobante en revisión ni si ya hay uno aceptado", () => {
    expect(shouldExpire({ ...base, proofs: [{ status: "pending_review" }], now })).toBe(false)
    expect(shouldExpire({ ...base, proofs: [{ status: "accepted" }], now })).toBe(false)
  })

  it("con comprobantes solo rechazados sí cancela", () => {
    expect(shouldExpire({ ...base, proofs: [{ status: "rejected" }], now })).toBe(true)
  })

  it("no toca pedidos que no son pendientes ni por transferencia ni sin fecha", () => {
    expect(shouldExpire({ ...base, status: "completed", now })).toBe(false)
    expect(shouldExpire({ ...base, status: "canceled", now })).toBe(false)
    expect(shouldExpire({ ...base, method: "card", now })).toBe(false)
    expect(shouldExpire({ ...base, dueAt: null, now })).toBe(false)
  })
})
