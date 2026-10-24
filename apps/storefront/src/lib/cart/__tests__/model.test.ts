import { describe, expect, it } from "vitest"
import {
  buildCartView,
  cartCookieOptions,
  findUnavailableLines,
  parseCartError,
  parseCartInput,
} from "../model"

const medusaCart = {
  id: "cart_1",
  currency_code: "ars",
  item_subtotal: 5000,
  subtotal: 6200,
  shipping_total: 1200,
  total: 6200,
  items: [
    {
      id: "item_1",
      variant_id: "var_1",
      product_id: "prod_1",
      product_title: "Pijama",
      product_handle: "pijama",
      variant_title: "M / Negro",
      thumbnail: "http://localhost:9000/static/a.png",
      quantity: 2,
      unit_price: 2000,
      total: 4000,
    },
    {
      id: "item_2",
      variant_id: "var_2",
      product_id: "prod_2",
      product_title: "Corpiño",
      product_handle: null,
      variant_title: null,
      thumbnail: null,
      quantity: 1,
      unit_price: 1000,
      total: 1000,
    },
  ],
}

describe("buildCartView", () => {
  it("arma las líneas con los precios que calculó Medusa", () => {
    const view = buildCartView(medusaCart)
    expect(view).toMatchObject({ id: "cart_1", currencyCode: "ars", total: 6200, subtotal: 5000, shippingTotal: 1200, itemCount: 3 })
    expect(view.lines[0]).toEqual({
      id: "item_1",
      variantId: "var_1",
      productId: "prod_1",
      title: "Pijama",
      variantTitle: "M / Negro",
      handle: "pijama",
      imageUrl: "http://localhost:9000/static/a.png",
      quantity: 2,
      unitPrice: 2000,
      total: 4000,
    })
    expect(view.lines[1]).toMatchObject({ variantTitle: null, handle: null, imageUrl: null })
  })

  it("un carrito sin líneas o ausente es un carrito vacío", () => {
    expect(buildCartView({ ...medusaCart, items: [] })).toMatchObject({ lines: [], itemCount: 0 })
    expect(buildCartView(null)).toMatchObject({ id: null, lines: [], itemCount: 0, total: 0 })
  })
})

describe("parseCartError", () => {
  it("STOCK_INSUFFICIENT informa la cantidad disponible", () => {
    const error = parseCartError({
      code: "STOCK_INSUFFICIENT",
      message: JSON.stringify({ variant_id: "v", available: 2 }),
    })
    expect(error.code).toBe("STOCK_INSUFFICIENT")
    expect(error.message).toContain("2")
  })

  it("sin stock en absoluto lo dice sin números raros", () => {
    const error = parseCartError({ code: "STOCK_INSUFFICIENT", message: '{"available":0}' })
    expect(error.message).toMatch(/agotad/i)
  })

  it("MAX_UNITS_EXCEEDED informa el máximo", () => {
    const error = parseCartError({
      code: "MAX_UNITS_EXCEEDED",
      message: JSON.stringify({ max_units_per_variant: 5 }),
    })
    expect(error.message).toContain("5")
  })

  it("VARIANT_UNAVAILABLE pide elegir otra combinación", () => {
    expect(parseCartError({ code: "VARIANT_UNAVAILABLE", message: "{}" }).message).toMatch(/otra/i)
  })

  it("un error desconocido no filtra el mensaje interno de Medusa", () => {
    const error = parseCartError({ code: "unknown_error", message: "select * from cart failed at 10.0.0.3" })
    expect(error.code).toBe("CART_ERROR")
    expect(error.message).not.toContain("select")
  })

  it("un mensaje que no es JSON no rompe el análisis", () => {
    expect(() => parseCartError({ code: "STOCK_INSUFFICIENT", message: "texto" })).not.toThrow()
  })
})

describe("parseCartInput", () => {
  it("acepta una variante y una cantidad entera positiva", () => {
    expect(parseCartInput({ variantId: "variant_01ABC", quantity: 2 })).toEqual({
      variantId: "variant_01ABC",
      quantity: 2,
    })
  })

  it("rechaza lo que no es una variante o una cantidad válida", () => {
    for (const bad of [
      { variantId: "../admin", quantity: 1 },
      { variantId: "variant_1", quantity: 0 },
      { variantId: "variant_1", quantity: 1.5 },
      { variantId: "variant_1", quantity: 1000 },
      { variantId: "variant_1" },
      null,
    ]) {
      expect(parseCartInput(bad)).toBeNull()
    }
  })

  it("ignora campos de precio que alguien intente colar (SEC-30)", () => {
    expect(parseCartInput({ variantId: "variant_1", quantity: 1, unit_price: 1 })).toEqual({
      variantId: "variant_1",
      quantity: 1,
    })
  })
})

describe("cartCookieOptions", () => {
  it("es HttpOnly y SameSite=Lax, y Secure solo cuando se sirve por HTTPS", () => {
    expect(cartCookieOptions("https://api.aloe.com")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    })
    expect(cartCookieOptions("http://localhost:9000")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    })
  })

  it("dura 30 días", () => {
    expect(cartCookieOptions("http://localhost:9000").maxAge).toBe(60 * 60 * 24 * 30)
  })
})

describe("findUnavailableLines", () => {
  const view = buildCartView(medusaCart)

  it("marca las líneas cuyo producto ya no está publicado", () => {
    expect(findUnavailableLines(view.lines, new Set(["prod_1"])).map((l) => l.id)).toEqual(["item_2"])
  })

  it("si todo sigue publicado no marca nada", () => {
    expect(findUnavailableLines(view.lines, new Set(["prod_1", "prod_2"]))).toEqual([])
  })

  it("una línea sin producto conocido se considera no disponible", () => {
    const lines = [{ ...view.lines[0], productId: "" }]
    expect(findUnavailableLines(lines, new Set(["prod_1"]))).toHaveLength(1)
  })
})

describe("parseCartError · confirmar el pedido", () => {
  it("traduce los errores de la confirmación sin dejar pasar el mensaje interno", () => {
    const cases: Record<string, RegExp> = {
      PENDING_ORDERS_LIMIT: /pedidos pendientes/i,
      PAYMENT_METHOD_REQUIRED: /cómo querés pagar/i,
      PAYMENT_PROVIDER_UNAVAILABLE: /no está disponible/i,
      CHECKOUT_INCOMPLETE: /datos|entrega/i,
      CART_ALREADY_COMPLETED: /ya fue confirmado/i,
      DISCOUNT_PAYMENT_MISMATCH: /transferencia/i,
    }
    for (const [code, pattern] of Object.entries(cases)) {
      const error = parseCartError({ code, message: "detalle interno select * from x" })
      expect(error.code).toBe(code)
      expect(error.message).toMatch(pattern)
      expect(error.message).not.toContain("select")
    }
  })
})
