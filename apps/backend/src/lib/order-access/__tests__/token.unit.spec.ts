import { generateToken, hashToken, isTokenExpired, verifyToken } from "../token"

describe("generateToken", () => {
  it("tiene al menos 32 bytes de entropía y es distinto cada vez", () => {
    const a = generateToken()
    const b = generateToken()
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(32)
    expect(a).not.toEqual(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe("hashToken / verifyToken", () => {
  it("el hash no contiene el token", () => {
    const token = generateToken()
    expect(hashToken(token)).not.toContain(token)
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/)
  })

  it("acepta el token correcto, varias veces", () => {
    const token = generateToken()
    const hash = hashToken(token)
    expect(verifyToken(token, hash)).toBe(true)
    expect(verifyToken(token, hash)).toBe(true)
  })

  it("rechaza un token distinto, vacío o de otro largo", () => {
    const hash = hashToken(generateToken())
    expect(verifyToken(generateToken(), hash)).toBe(false)
    expect(verifyToken("", hash)).toBe(false)
    expect(verifyToken("a", hash)).toBe(false)
  })

  it("sin hash guardado (pedido sin token o inexistente) siempre rechaza", () => {
    expect(verifyToken(generateToken(), null)).toBe(false)
    expect(verifyToken(generateToken(), "")).toBe(false)
    expect(verifyToken(generateToken(), "no-es-un-hash")).toBe(false)
  })
})

describe("isTokenExpired (SEC-24)", () => {
  const now = new Date("2026-11-30T12:00:00Z")
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

  it("un pedido abierto no vence", () => {
    expect(isTokenExpired({ status: "pending", updatedAt: daysAgo(90) }, now)).toBe(false)
  })

  it("vence 30 días después de cerrarse (completado o cancelado)", () => {
    for (const status of ["completed", "canceled"]) {
      expect(isTokenExpired({ status, updatedAt: daysAgo(29) }, now)).toBe(false)
      expect(isTokenExpired({ status, updatedAt: daysAgo(31) }, now)).toBe(true)
    }
  })
})
