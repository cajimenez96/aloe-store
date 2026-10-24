import { buildEvent, maskEmail, redactText } from "../redact"

describe("maskEmail", () => {
  it("deja ver solo la inicial y el dominio", () => {
    expect(maskEmail("ana.perez@ejemplo.com")).toBe("a***@ejemplo.com")
  })
  it("un valor que no es un email no se muestra", () => {
    expect(maskEmail("nada")).toBe("***")
    expect(maskEmail(undefined)).toBe("***")
  })
})

describe("redactText (SEC-70)", () => {
  it("oculta un CBU o CVU de 22 dígitos", () => {
    expect(redactText("transferir a 0170099220000067797370 hoy")).not.toContain("0170099220000067797370")
  })

  it("oculta tokens de acceso al pedido", () => {
    const token = "QvAt6PWHkc6TtQPF2RXTNEmJM4eh1k0NtR4DS6I8Gqs"
    expect(redactText(`https://tienda/pedido/order_1/acceso?token=${token}`)).not.toContain(token)
  })

  it("oculta teléfonos y documentos largos escritos como números", () => {
    const out = redactText("tel +54 9 341 555-1234 doc 30.123.456 dni 30123456")
    expect(out).not.toMatch(/555-1234/)
    expect(out).not.toContain("30123456")
    expect(out).not.toContain("30.123.456")
  })

  it("oculta emails completos", () => {
    expect(redactText("de ana@ejemplo.com para dueno@x.com")).not.toMatch(/@ejemplo\.com|@x\.com/)
  })

  it("no toca identificadores de pedido ni texto normal", () => {
    expect(redactText("order_01M5QKQ9Y5ZCGPWRZAJN5EF2W5 cancelado por vencimiento")).toBe(
      "order_01M5QKQ9Y5ZCGPWRZAJN5EF2W5 cancelado por vencimiento"
    )
  })
})

describe("buildEvent", () => {
  const base = { event: "role_denied", requestId: "req-1", at: new Date("2026-10-24T18:00:00Z") }

  it("arma el evento con nombre, solicitud y fecha", () => {
    expect(buildEvent({ ...base, fields: { actor_id: "user_1", order_id: "order_1" } })).toEqual({
      event: "role_denied",
      request_id: "req-1",
      at: "2026-10-24T18:00:00.000Z",
      actor_id: "user_1",
      order_id: "order_1",
    })
  })

  it("descarta los campos con datos personales aunque alguien los pase", () => {
    const event = buildEvent({
      ...base,
      fields: {
        cbu: "0170099220000067797370",
        document: "30123456",
        customer_document: "30123456",
        phone: "1155551234",
        address: "Av. Siempreviva 742",
        address_1: "Av. Siempreviva 742",
        email: "ana@ejemplo.com",
        token: "secreto",
        password: "x",
        file: "contenido",
        ok: "visible",
      },
    })
    expect(Object.keys(event).sort()).toEqual(["at", "event", "ok", "request_id"])
  })

  it("depura también los valores de texto que parecen datos personales", () => {
    const event = buildEvent({ ...base, fields: { reason: "cuenta 0170099220000067797370 inválida" } })
    expect(JSON.stringify(event)).not.toContain("0170099220000067797370")
  })

  it("los valores que no son texto, número o booleano se descartan", () => {
    const event = buildEvent({ ...base, fields: { nested: { a: 1 }, list: [1], fn: () => 1, n: 5, b: true, nothing: null } as never })
    expect(event).toMatchObject({ n: 5, b: true })
    expect("nested" in event).toBe(false)
    expect("list" in event).toBe(false)
  })

  it("sin solicitud el campo queda en null", () => {
    expect(buildEvent({ event: "x", requestId: undefined, at: new Date(0), fields: {} }).request_id).toBeNull()
  })
})
