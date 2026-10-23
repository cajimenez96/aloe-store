import { describe, expect, it } from "vitest"
import { parseCheckoutForm } from "../schema"

const base = {
  name: "Ana Pérez",
  email: "ana@ejemplo.com",
  phone: "11 5555-1234",
  document: "",
  shippingOptionId: "so_01ABC",
}
const address = { street: "Av. Siempreviva 742", city: "Rosario", province: "Santa Fe", postalCode: "2000" }

describe("parseCheckoutForm · retiro", () => {
  it("acepta nombre, email y teléfono sin dirección", () => {
    const result = parseCheckoutForm(base, "pickup")
    expect(result).toEqual({
      ok: true,
      data: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@ejemplo.com",
        phone: "11 5555-1234",
        document: null,
        shippingOptionId: "so_01ABC",
        address: null,
      },
    })
  })

  it("ignora la dirección si se retira en el local", () => {
    const result = parseCheckoutForm({ ...base, ...address }, "pickup")
    expect(result.ok && result.data.address).toBeNull()
  })

  it("un nombre de una sola palabra queda como nombre", () => {
    const result = parseCheckoutForm({ ...base, name: "Ana" }, "pickup")
    expect(result.ok && [result.data.firstName, result.data.lastName]).toEqual(["Ana", ""])
  })
})

describe("parseCheckoutForm · campos obligatorios y formato", () => {
  it("nombre, email y teléfono son obligatorios, con un mensaje por campo", () => {
    const result = parseCheckoutForm({ ...base, name: " ", email: "", phone: "" }, "pickup")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["email", "name", "phone"])
      expect(result.errors.name).toMatch(/nombre/i)
    }
  })

  it("rechaza emails mal formados", () => {
    for (const email of ["ana", "ana@", "ana@ejemplo", "a na@ejemplo.com", "ana@@ejemplo.com"]) {
      const result = parseCheckoutForm({ ...base, email }, "pickup")
      expect(result.ok, email).toBe(false)
    }
  })

  it("rechaza teléfonos con letras o muy cortos y acepta formatos habituales", () => {
    for (const phone of ["abc", "12345", "11-ABCD-1234"]) {
      expect(parseCheckoutForm({ ...base, phone }, "pickup").ok, phone).toBe(false)
    }
    for (const phone of ["+54 9 11 5555-1234", "(0341) 555-1234", "1155551234"]) {
      expect(parseCheckoutForm({ ...base, phone }, "pickup").ok, phone).toBe(true)
    }
  })

  it("el documento es opcional y, si se informa, tiene 7 a 11 dígitos", () => {
    expect(parseCheckoutForm({ ...base, document: "30.123.456" }, "pickup")).toMatchObject({
      ok: true,
      data: { document: "30123456" },
    })
    const bad = parseCheckoutForm({ ...base, document: "12" }, "pickup")
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.document).toBeDefined()
  })

  it("recorta espacios y limita el largo", () => {
    expect(parseCheckoutForm({ ...base, name: "x".repeat(101) }, "pickup").ok).toBe(false)
    expect(parseCheckoutForm({ ...base, email: "  ana@ejemplo.com " }, "pickup")).toMatchObject({
      ok: true,
      data: { email: "ana@ejemplo.com" },
    })
  })

  it("la opción de entrega debe ser un identificador válido", () => {
    expect(parseCheckoutForm({ ...base, shippingOptionId: "../x" }, "pickup").ok).toBe(false)
    expect(parseCheckoutForm({ ...base, shippingOptionId: "" }, "pickup").ok).toBe(false)
  })
})

describe("parseCheckoutForm · envío", () => {
  it("exige la dirección completa", () => {
    const result = parseCheckoutForm(base, "delivery")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["city", "postalCode", "province", "street"])
    }
  })

  it("con dirección completa la devuelve normalizada", () => {
    expect(parseCheckoutForm({ ...base, ...address }, "delivery")).toMatchObject({
      ok: true,
      data: { address: { street: "Av. Siempreviva 742", city: "Rosario", province: "Santa Fe", postalCode: "2000" } },
    })
  })

  it("rechaza un código postal con caracteres raros", () => {
    expect(parseCheckoutForm({ ...base, ...address, postalCode: "<script>" }, "delivery").ok).toBe(false)
  })
})
