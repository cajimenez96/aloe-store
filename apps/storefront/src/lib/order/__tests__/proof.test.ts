import { describe, expect, it } from "vitest"
import { MAX_PROOF_BYTES, proofErrorMessage, proofStatusLabel } from "../proof"

describe("proofErrorMessage", () => {
  it("usa los textos del catálogo para cada error de la subida", () => {
    const cases: Record<string, RegExp> = {
      TRANSFER_PROOF_TOO_LARGE: /5 MB/,
      TRANSFER_PROOF_FORMAT_INVALID: /JPG, PNG o PDF/,
      TRANSFER_PROOF_PENDING: /en revisión/,
      ORDER_EXPIRED: /venció/,
      ORDER_ALREADY_PAID: /ya está pagado/,
      TOO_MANY_UPLOADS: /demasiados/,
      ORDER_ACCESS_DENIED: /enlace/,
    }
    for (const [code, pattern] of Object.entries(cases)) {
      expect(proofErrorMessage(code)).toMatch(pattern)
    }
  })

  it("un error desconocido no deja pasar detalles internos", () => {
    expect(proofErrorMessage("algo raro")).toMatch(/probá de nuevo/i)
    expect(proofErrorMessage(undefined)).toMatch(/probá de nuevo/i)
  })
})

describe("proofStatusLabel", () => {
  it("explica cada estado del último comprobante", () => {
    expect(proofStatusLabel({ status: "pending_review", rejection_reason: null })).toMatch(/revisando/i)
    expect(proofStatusLabel({ status: "accepted", rejection_reason: null })).toMatch(/pago confirmado/i)
    expect(proofStatusLabel({ status: "rejected", rejection_reason: "El monto no coincide." })).toContain(
      "El monto no coincide."
    )
  })

  it("no duplica el punto final del motivo", () => {
    const label = proofStatusLabel({ status: "rejected", rejection_reason: "No se ve el monto." }) ?? ""
    expect(label).not.toContain("..")
    expect(proofStatusLabel({ status: "rejected", rejection_reason: "Sin punto final" })).toContain("Sin punto final.")
  })

  it("sin comprobante no hay estado", () => {
    expect(proofStatusLabel(null)).toBeNull()
  })

  it("el límite de tamaño es de 5 MB", () => {
    expect(MAX_PROOF_BYTES).toBe(5 * 1024 * 1024)
  })
})
