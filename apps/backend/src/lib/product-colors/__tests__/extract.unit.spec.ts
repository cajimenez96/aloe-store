import { extractColors } from "../extract"

const product = (options: unknown) => ({ id: "prod_1", options })

describe("extractColors", () => {
  it("devuelve los valores de la opción Color con su muestra", () => {
    expect(
      extractColors(
        product([
          { title: "Talle", values: [{ id: "v_m", value: "M", product_color: null }] },
          {
            title: "Color",
            values: [
              { id: "v_negro", value: "Negro", product_color: { hex: "#111111" } },
              { id: "v_rosa", value: "Rosa", product_color: null },
            ],
          },
        ])
      )
    ).toEqual([
      { option_value_id: "v_negro", value: "Negro", hex: "#111111" },
      { option_value_id: "v_rosa", value: "Rosa", hex: null },
    ])
  })

  it("reconoce la opción Color sin importar mayúsculas ni espacios", () => {
    expect(
      extractColors(
        product([{ title: "  COLOR ", values: [{ id: "v1", value: "Azul", product_color: { hex: "#0000FF" } }] }])
      )
    ).toHaveLength(1)
  })

  it("sin opción Color devuelve una lista vacía", () => {
    expect(extractColors(product([{ title: "Talle", values: [] }]))).toEqual([])
  })

  it("tolera datos faltantes", () => {
    expect(extractColors(undefined)).toEqual([])
    expect(extractColors({ id: "x" })).toEqual([])
    expect(extractColors(product(null))).toEqual([])
    expect(extractColors(product([{ title: "Color" }]))).toEqual([])
    expect(extractColors(product([null, { title: "Color", values: [null] }]))).toEqual([])
  })

  it("junta los valores si hubiera más de una opción llamada Color", () => {
    expect(
      extractColors(
        product([
          { title: "Color", values: [{ id: "a", value: "A", product_color: null }] },
          { title: "color", values: [{ id: "b", value: "B", product_color: null }] },
        ])
      ).map((c) => c.option_value_id)
    ).toEqual(["a", "b"])
  })
})
