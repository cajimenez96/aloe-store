import { describe, expect, it } from "vitest"
import { buildDetailModel } from "../product"

const product = {
  id: "prod_1",
  title: "Pijama",
  handle: "pijama",
  description: "De algodón.",
  thumbnail: "http://localhost:9000/static/t.png",
  images: [{ url: "http://localhost:9000/static/1.png" }, { url: "http://localhost:9000/static/2.png" }],
  options: [
    { id: "opt_talle", title: "Talle", values: [{ id: "v_m", value: "M" }, { id: "v_l", value: "L" }] },
    { id: "opt_color", title: "Color", values: [{ id: "v_n", value: "Negro" }, { id: "v_r", value: "Rosa" }] },
  ],
  variants: [
    {
      id: "var_mn",
      title: "M / Negro",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 5,
      calculated_price: { calculated_amount: 2000, currency_code: "ars" },
      options: [{ option_id: "opt_talle", value: "M" }, { option_id: "opt_color", value: "Negro" }],
    },
    {
      id: "var_ln",
      title: "L / Negro",
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 0,
      calculated_price: { calculated_amount: 2400.5, currency_code: "ars" },
      options: [{ option_id: "opt_talle", value: "L" }, { option_id: "opt_color", value: "Negro" }],
    },
  ],
}

const colors = [
  { option_value_id: "v_n", value: "Negro", hex: "#111111" },
  { option_value_id: "v_r", value: "Rosa", hex: null },
]

describe("buildDetailModel", () => {
  const model = buildDetailModel(product, colors)

  it("copia los datos básicos", () => {
    expect(model).toMatchObject({ title: "Pijama", description: "De algodón." })
  })

  it("arma las opciones con la muestra de los valores de Color", () => {
    const color = model.options.find((o) => o.id === "opt_color")!
    expect(color.values).toEqual([
      { id: "v_n", value: "Negro", hex: "#111111" },
      { id: "v_r", value: "Rosa", hex: null },
    ])
    const talle = model.options.find((o) => o.id === "opt_talle")!
    expect(talle.values.every((v) => !("hex" in v) || v.hex === undefined)).toBe(true)
  })

  it("arma las variantes para el selector con su stock", () => {
    expect(model.selectorVariants).toEqual([
      {
        id: "var_mn",
        inStock: true,
        options: [{ option_id: "opt_talle", value: "M" }, { option_id: "opt_color", value: "Negro" }],
      },
      {
        id: "var_ln",
        inStock: false,
        options: [{ option_id: "opt_talle", value: "L" }, { option_id: "opt_color", value: "Negro" }],
      },
    ])
  })

  it("guarda el precio de cada variante, con centavos tal como los calcula Medusa", () => {
    expect(model.prices).toEqual({
      var_mn: { amount: 2000, currencyCode: "ars" },
      var_ln: { amount: 2400.5, currencyCode: "ars" },
    })
  })

  it("lista las imágenes, o usa la miniatura si no hay galería", () => {
    expect(model.images).toEqual([
      "http://localhost:9000/static/1.png",
      "http://localhost:9000/static/2.png",
    ])
    expect(buildDetailModel({ ...product, images: [] }, colors).images).toEqual([
      "http://localhost:9000/static/t.png",
    ])
    expect(buildDetailModel({ ...product, images: null, thumbnail: null }, colors).images).toEqual([])
  })

  it("una variante sin precio no tiene precio y no se puede comprar", () => {
    const withoutPrice = buildDetailModel(
      {
        ...product,
        variants: [{ ...product.variants[0], calculated_price: null }],
      },
      colors
    )
    expect(withoutPrice.prices).toEqual({})
    expect(withoutPrice.selectorVariants[0].inStock).toBe(false)
  })

  it("una variante con reserva sin stock o sin gestión de inventario cuenta como disponible", () => {
    const m = buildDetailModel(
      {
        ...product,
        variants: [
          { ...product.variants[1], allow_backorder: true },
          { ...product.variants[1], id: "var_x", manage_inventory: false },
        ],
      },
      colors
    )
    expect(m.selectorVariants.map((v) => v.inStock)).toEqual([true, true])
  })

  it("sin colores publicados las opciones de Color quedan sin muestra", () => {
    const m = buildDetailModel(product, [])
    const color = m.options.find((o) => o.id === "opt_color")!
    expect(color.values.map((v) => v.hex ?? null)).toEqual([null, null])
  })
})
