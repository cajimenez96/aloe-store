import { describe, expect, it } from "vitest"
import {
  buildCatalogHref,
  pagination,
  parseCatalogParams,
  summarizeProduct,
} from "../catalog"

describe("parseCatalogParams", () => {
  it("usa los valores por defecto sin parámetros", () => {
    expect(parseCatalogParams({})).toEqual({ q: "", categoria: null, pagina: 1 })
  })

  it("lee búsqueda, categoría y página", () => {
    expect(
      parseCatalogParams({ q: " bombacha ", categoria: "ropa-interior", pagina: "3" })
    ).toEqual({ q: "bombacha", categoria: "ropa-interior", pagina: 3 })
  })

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parseCatalogParams({ q: ["a", "b"], pagina: ["2", "5"] })).toMatchObject({
      q: "a",
      pagina: 2,
    })
  })

  it("una página inválida vuelve a la primera", () => {
    for (const bad of ["0", "-2", "abc", "1.5", "", "1e3", "999999999"]) {
      expect(parseCatalogParams({ pagina: bad }).pagina).toBe(1)
    }
  })

  it("una categoría con caracteres raros se descarta", () => {
    for (const bad of ["../admin", "Ropa Interior", "a;b", "x".repeat(101), "<script>"]) {
      expect(parseCatalogParams({ categoria: bad }).categoria).toBeNull()
    }
  })

  it("acota la búsqueda a 100 caracteres", () => {
    expect(parseCatalogParams({ q: "a".repeat(300) }).q).toHaveLength(100)
  })
})

describe("buildCatalogHref", () => {
  it("sin filtros apunta al listado", () => {
    expect(buildCatalogHref({ q: "", categoria: null, pagina: 1 })).toBe("/productos")
  })

  it("incluye solo lo que no es el valor por defecto", () => {
    expect(buildCatalogHref({ q: "pijama", categoria: null, pagina: 1 })).toBe(
      "/productos?q=pijama"
    )
    expect(buildCatalogHref({ q: "", categoria: "medias", pagina: 2 })).toBe(
      "/productos?categoria=medias&pagina=2"
    )
  })

  it("codifica la búsqueda", () => {
    expect(buildCatalogHref({ q: "ropa & más", categoria: null, pagina: 1 })).toBe(
      "/productos?q=ropa+%26+m%C3%A1s"
    )
  })

  it("permite cambiar un parámetro conservando los demás", () => {
    const base = { q: "pijama", categoria: "ropa", pagina: 4 }
    expect(buildCatalogHref({ ...base, pagina: 1 })).toBe("/productos?q=pijama&categoria=ropa")
  })
})

describe("pagination", () => {
  it("calcula páginas y rango", () => {
    expect(pagination(30, 1, 12)).toEqual({
      totalPages: 3,
      hasPrev: false,
      hasNext: true,
      from: 1,
      to: 12,
    })
    expect(pagination(30, 3, 12)).toEqual({
      totalPages: 3,
      hasPrev: true,
      hasNext: false,
      from: 25,
      to: 30,
    })
  })

  it("sin resultados no hay páginas ni rango", () => {
    expect(pagination(0, 1, 12)).toEqual({
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
      from: 0,
      to: 0,
    })
  })

  it("una página que se pasa del total no tiene siguiente", () => {
    expect(pagination(5, 9, 12).hasNext).toBe(false)
  })
})

describe("summarizeProduct", () => {
  const variant = (amount: number, stock: number | null, extra = {}) => ({
    manage_inventory: stock !== null,
    allow_backorder: false,
    inventory_quantity: stock,
    calculated_price: { calculated_amount: amount, currency_code: "ars" },
    ...extra,
  })

  it("toma el menor precio entre las variantes", () => {
    const summary = summarizeProduct({
      title: "Pijama",
      handle: "pijama",
      thumbnail: "http://localhost:9000/static/a.png",
      variants: [variant(2500, 3), variant(2000, 1), variant(3000, 2)],
    })
    expect(summary).toMatchObject({
      title: "Pijama",
      handle: "pijama",
      imageUrl: "http://localhost:9000/static/a.png",
      listPrice: 2000,
      currencyCode: "ars",
      soldOut: false,
    })
  })

  it("está agotado cuando ninguna variante tiene stock", () => {
    expect(
      summarizeProduct({ title: "x", handle: "x", variants: [variant(10, 0), variant(10, 0)] })
        .soldOut
    ).toBe(true)
  })

  it("no está agotado si alguna variante tiene stock", () => {
    expect(
      summarizeProduct({ title: "x", handle: "x", variants: [variant(10, 0), variant(10, 2)] })
        .soldOut
    ).toBe(false)
  })

  it("una variante que no gestiona inventario o admite reserva sin stock cuenta como disponible", () => {
    expect(
      summarizeProduct({ title: "x", handle: "x", variants: [variant(10, null)] }).soldOut
    ).toBe(false)
    expect(
      summarizeProduct({
        title: "x",
        handle: "x",
        variants: [variant(10, 0, { allow_backorder: true })],
      }).soldOut
    ).toBe(false)
  })

  it("sin imagen devuelve null", () => {
    expect(
      summarizeProduct({ title: "x", handle: "x", variants: [variant(10, 1)] }).imageUrl
    ).toBeNull()
  })

  it("sin variantes con precio, el producto no tiene precio", () => {
    expect(summarizeProduct({ title: "x", handle: "x", variants: [] }).listPrice).toBeNull()
    expect(
      summarizeProduct({
        title: "x",
        handle: "x",
        variants: [{ manage_inventory: false, calculated_price: null }],
      }).listPrice
    ).toBeNull()
  })
})
