import { signProofLink, verifyProofLink } from "../signed-link"

const secret = "s".repeat(32)
const now = new Date("2026-10-24T12:00:00Z")
const minutes = (n: number) => new Date(now.getTime() + n * 60_000)

describe("enlace firmado del comprobante (SEC-51)", () => {
  it("vale durante 15 minutos", () => {
    const token = signProofLink("tp_1", secret, now)
    expect(verifyProofLink("tp_1", token, secret, minutes(14))).toBe(true)
    expect(verifyProofLink("tp_1", token, secret, minutes(16))).toBe(false)
  })

  it("solo sirve para su comprobante", () => {
    const token = signProofLink("tp_1", secret, now)
    expect(verifyProofLink("tp_2", token, secret, now)).toBe(false)
  })

  it("no sirve con otra clave ni alterado", () => {
    const token = signProofLink("tp_1", secret, now)
    expect(verifyProofLink("tp_1", token, "x".repeat(32), now)).toBe(false)
    const [exp, sig] = token.split(".")
    expect(verifyProofLink("tp_1", `${Number(exp) + 600000}.${sig}`, secret, now)).toBe(false)
    expect(verifyProofLink("tp_1", `${exp}.${sig.slice(0, -2)}aa`, secret, now)).toBe(false)
  })

  it("un valor mal formado se rechaza sin romper", () => {
    for (const bad of ["", "abc", "1.2.3", ".", "x.y", "9999999999999."]) {
      expect(verifyProofLink("tp_1", bad, secret, now)).toBe(false)
    }
  })
})
