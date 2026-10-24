import { canReview, validateRejectionReason } from "../review"

describe("validateRejectionReason (HU-29)", () => {
  it("acepta un motivo de 10 a 300 caracteres", () => {
    expect(validateRejectionReason("El monto no coincide con el total.")).toEqual({
      ok: true,
      reason: "El monto no coincide con el total.",
    })
    expect(validateRejectionReason("x".repeat(10)).ok).toBe(true)
    expect(validateRejectionReason("x".repeat(300)).ok).toBe(true)
  })

  it("rechaza motivos cortos, largos, vacíos o que no son texto", () => {
    for (const bad of ["", "corto", " ".repeat(20), "x".repeat(301), null, undefined, 42]) {
      expect(validateRejectionReason(bad)).toEqual({ ok: false })
    }
  })

  it("recorta los espacios antes de contar", () => {
    expect(validateRejectionReason("   corto   ")).toEqual({ ok: false })
    expect(validateRejectionReason("  motivo válido y claro  ")).toMatchObject({ ok: true, reason: "motivo válido y claro" })
  })
})

describe("canReview", () => {
  it("solo se revisa lo que está en revisión", () => {
    expect(canReview("pending_review")).toBe(true)
    expect(canReview("accepted")).toBe(false)
    expect(canReview("rejected")).toBe(false)
  })
})
