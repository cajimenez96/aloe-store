import {
  MAX_IMAGE_BYTES,
  detectImageKind,
  validateImageFile,
} from "../validate-image"

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
])

const file = (
  overrides: Partial<{
    originalname: string
    mimetype: string
    size: number
    buffer: Buffer
  }> = {}
) => ({
  originalname: "foto.png",
  mimetype: "image/png",
  size: PNG.length,
  buffer: PNG,
  ...overrides,
})

describe("detectImageKind", () => {
  it("reconoce PNG, JPEG y WebP por su contenido", () => {
    expect(detectImageKind(PNG)).toBe("png")
    expect(detectImageKind(JPEG)).toBe("jpeg")
    expect(detectImageKind(WEBP)).toBe("webp")
  })

  it("devuelve null para texto, HTML y ejecutables", () => {
    expect(detectImageKind(Buffer.from("esto es texto"))).toBeNull()
    expect(detectImageKind(Buffer.from("<script>alert(1)</script>"))).toBeNull()
    expect(detectImageKind(Buffer.from("MZ\x90\x00"))).toBeNull()
    expect(detectImageKind(Buffer.alloc(0))).toBeNull()
  })

  it("no confunde un RIFF que no es WebP (por ejemplo WAV)", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WAVEfmt "),
    ])
    expect(detectImageKind(wav)).toBeNull()
  })
})

describe("validateImageFile", () => {
  it("acepta PNG, JPEG y WebP válidos", () => {
    expect(validateImageFile(file())).toBeNull()
    expect(
      validateImageFile(
        file({ originalname: "a.jpg", mimetype: "image/jpeg", buffer: JPEG })
      )
    ).toBeNull()
    expect(
      validateImageFile(
        file({ originalname: "a.JPEG", mimetype: "image/jpeg", buffer: JPEG })
      )
    ).toBeNull()
    expect(
      validateImageFile(
        file({ originalname: "a.webp", mimetype: "image/webp", buffer: WEBP })
      )
    ).toBeNull()
  })

  it("rechaza un archivo de más de 5 MB con IMAGE_TOO_LARGE (413)", () => {
    const error = validateImageFile(file({ size: MAX_IMAGE_BYTES + 1 }))
    expect(error).toMatchObject({
      status: 413,
      body: {
        type: "invalid_data",
        code: "IMAGE_TOO_LARGE",
        details: { max_mb: 5 },
      },
    })
    expect(error?.body.message).toContain("5 MB")
  })

  it("acepta un archivo de exactamente 5 MB", () => {
    expect(validateImageFile(file({ size: MAX_IMAGE_BYTES }))).toBeNull()
  })

  it("rechaza texto con extensión .png con IMAGE_FORMAT_INVALID (415)", () => {
    const error = validateImageFile(
      file({ buffer: Buffer.from("esto no es una imagen"), size: 21 })
    )
    expect(error).toMatchObject({
      status: 415,
      body: { code: "IMAGE_FORMAT_INVALID" },
    })
    expect(error?.body.message).toMatch(/JPG, PNG o WebP/)
  })

  it("rechaza HTML y ejecutables aunque declaren un tipo de imagen", () => {
    expect(
      validateImageFile(
        file({ originalname: "x.png", buffer: Buffer.from("<html>") })
      )?.body.code
    ).toBe("IMAGE_FORMAT_INVALID")
    expect(
      validateImageFile(
        file({
          originalname: "x.exe",
          mimetype: "application/octet-stream",
          buffer: Buffer.from("MZ\x90\x00"),
        })
      )?.body.code
    ).toBe("IMAGE_FORMAT_INVALID")
  })

  it("rechaza una imagen real cuya extensión no coincide con su contenido", () => {
    const error = validateImageFile(
      file({ originalname: "foto.jpg", mimetype: "image/png", buffer: PNG })
    )
    expect(error).toMatchObject({
      status: 415,
      body: { code: "IMAGE_FORMAT_INVALID" },
    })
  })

  it("rechaza una imagen real cuyo tipo declarado no coincide con su contenido", () => {
    const error = validateImageFile(
      file({ originalname: "foto.png", mimetype: "text/html", buffer: PNG })
    )
    expect(error?.body.code).toBe("IMAGE_FORMAT_INVALID")
  })

  it("rechaza un archivo sin extensión", () => {
    expect(
      validateImageFile(file({ originalname: "foto" }))?.body.code
    ).toBe("IMAGE_FORMAT_INVALID")
  })

  it("no revela el nombre original en el mensaje de error", () => {
    const error = validateImageFile(
      file({ originalname: "secreto-cliente.png", buffer: Buffer.from("x") })
    )
    expect(JSON.stringify(error)).not.toContain("secreto-cliente")
  })
})
