import { uploadBlocker } from "../rules"

const now = new Date("2026-10-24T12:00:00Z")
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000)
const hoursAhead = (h: number) => new Date(now.getTime() + h * 3_600_000)
const open = { status: "pending", dueAt: hoursAhead(10) }

describe("uploadBlocker (HU-28)", () => {
  it("un pedido abierto sin comprobantes puede subir", () => {
    expect(uploadBlocker({ order: open, proofs: [], now })).toBeNull()
  })

  it("un pedido cancelado o con el plazo vencido responde ORDER_EXPIRED", () => {
    expect(uploadBlocker({ order: { status: "canceled", dueAt: hoursAhead(5) }, proofs: [], now })).toBe("ORDER_EXPIRED")
    expect(uploadBlocker({ order: { status: "pending", dueAt: hoursAgo(1) }, proofs: [], now })).toBe("ORDER_EXPIRED")
  })

  it("con un comprobante en revisión no se puede subir otro", () => {
    expect(
      uploadBlocker({ order: open, proofs: [{ status: "pending_review", createdAt: hoursAgo(2) }], now })
    ).toBe("TRANSFER_PROOF_PENDING")
  })

  it("con un comprobante en revisión el plazo vencido no bloquea la consulta pero tampoco deja subir otro", () => {
    expect(
      uploadBlocker({
        order: { status: "pending", dueAt: hoursAgo(3) },
        proofs: [{ status: "pending_review", createdAt: hoursAgo(5) }],
        now,
      })
    ).toBe("TRANSFER_PROOF_PENDING")
  })

  it("después de un rechazo se puede subir otro", () => {
    expect(uploadBlocker({ order: open, proofs: [{ status: "rejected", createdAt: hoursAgo(2) }], now })).toBeNull()
  })

  it("un pedido con comprobante aceptado ya está pagado", () => {
    expect(uploadBlocker({ order: open, proofs: [{ status: "accepted", createdAt: hoursAgo(2) }], now })).toBe(
      "ORDER_ALREADY_PAID"
    )
  })

  it("máximo 5 subidas por hora por pedido (SEC-17)", () => {
    const rejected = (n: number) => Array.from({ length: n }, () => ({ status: "rejected", createdAt: hoursAgo(0.5) }))
    expect(uploadBlocker({ order: open, proofs: rejected(4), now })).toBeNull()
    expect(uploadBlocker({ order: open, proofs: rejected(5), now })).toBe("TOO_MANY_UPLOADS")
    const old = Array.from({ length: 5 }, () => ({ status: "rejected", createdAt: hoursAgo(2) }))
    expect(uploadBlocker({ order: open, proofs: old, now })).toBeNull()
  })
})
