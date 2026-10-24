import { validateProofFile } from "../validate"

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])
const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32)])
const MB = 1024 * 1024

describe("validateProofFile (SEC-51)", () => {
  it("acepta JPG, PNG y PDF por su contenido", () => {
    expect(validateProofFile(png)).toMatchObject({ ok: true, kind: "png", mime: "image/png" })
    expect(validateProofFile(jpg)).toMatchObject({ ok: true, kind: "jpg", mime: "image/jpeg" })
    expect(validateProofFile(pdf)).toMatchObject({ ok: true, kind: "pdf", mime: "application/pdf" })
  })

  it("rechaza lo que no es JPG, PNG ni PDF aunque se llame como uno", () => {
    for (const buffer of [Buffer.from("<html><script>alert(1)</script></html>"), Buffer.from("MZ\x90\x00 exe"), Buffer.alloc(0)]) {
      expect(validateProofFile(buffer)).toMatchObject({ ok: false, code: "TRANSFER_PROOF_FORMAT_INVALID" })
    }
  })

  it("un WebP o un GIF no se aceptan como comprobante", () => {
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(16)])
    expect(validateProofFile(webp)).toMatchObject({ ok: false, code: "TRANSFER_PROOF_FORMAT_INVALID" })
    expect(validateProofFile(Buffer.from("GIF89a....."))).toMatchObject({ ok: false })
  })

  it("rechaza más de 5 MB y acepta justo 5 MB", () => {
    const big = Buffer.concat([png, Buffer.alloc(5 * MB)])
    expect(validateProofFile(big)).toMatchObject({ ok: false, code: "TRANSFER_PROOF_TOO_LARGE" })
    const exact = Buffer.concat([png, Buffer.alloc(5 * MB - png.length)])
    expect(validateProofFile(exact)).toMatchObject({ ok: true })
  })
})
