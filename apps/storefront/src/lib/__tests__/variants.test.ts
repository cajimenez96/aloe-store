import { describe, expect, it } from "vitest"
import {
  findVariant,
  isValueAvailable,
  isValueInStock,
  type SelectorVariant,
} from "../variants"

const TALLE = "opt_talle"
const COLOR = "opt_color"

const variants: SelectorVariant[] = [
  { id: "v1", inStock: true, options: [{ option_id: TALLE, value: "M" }, { option_id: COLOR, value: "Negro" }] },
  { id: "v2", inStock: false, options: [{ option_id: TALLE, value: "L" }, { option_id: COLOR, value: "Negro" }] },
  { id: "v3", inStock: true, options: [{ option_id: TALLE, value: "L" }, { option_id: COLOR, value: "Rosa" }] },
]

describe("findVariant", () => {
  it("encuentra la variante cuando todas las opciones están elegidas", () => {
    expect(findVariant(variants, { [TALLE]: "M", [COLOR]: "Negro" }, 2)?.id).toBe("v1")
    expect(findVariant(variants, { [TALLE]: "L", [COLOR]: "Rosa" }, 2)?.id).toBe("v3")
  })

  it("devuelve null si falta elegir una opción", () => {
    expect(findVariant(variants, { [TALLE]: "M" }, 2)).toBeNull()
    expect(findVariant(variants, {}, 2)).toBeNull()
  })

  it("devuelve null si esa combinación no existe", () => {
    expect(findVariant(variants, { [TALLE]: "M", [COLOR]: "Rosa" }, 2)).toBeNull()
  })

  it("un producto con una sola opción se resuelve con esa opción", () => {
    const single: SelectorVariant[] = [
      { id: "s1", inStock: true, options: [{ option_id: TALLE, value: "U" }] },
    ]
    expect(findVariant(single, { [TALLE]: "U" }, 1)?.id).toBe("s1")
  })
})

describe("isValueAvailable", () => {
  it("un valor está disponible si existe alguna variante con él que respete lo ya elegido", () => {
    expect(isValueAvailable(variants, {}, COLOR, "Rosa")).toBe(true)
    expect(isValueAvailable(variants, { [TALLE]: "L" }, COLOR, "Rosa")).toBe(true)
  })

  it("no ofrece combinaciones que no existen como variante", () => {
    // M solo existe en Negro: con M elegido, Rosa no se puede elegir.
    expect(isValueAvailable(variants, { [TALLE]: "M" }, COLOR, "Rosa")).toBe(false)
    expect(isValueAvailable(variants, { [COLOR]: "Rosa" }, TALLE, "M")).toBe(false)
  })

  it("no cuenta la selección de la misma opción que se evalúa", () => {
    // Con talle M elegido, igual se puede cambiar a L si existe alguna variante L.
    expect(isValueAvailable(variants, { [TALLE]: "M" }, TALLE, "L")).toBe(true)
  })

  it("un valor que no está en ninguna variante no está disponible", () => {
    expect(isValueAvailable(variants, {}, COLOR, "Verde")).toBe(false)
  })

  it("un valor cuya única variante está agotada sigue disponible: se elige y se marca", () => {
    const soloAgotada: SelectorVariant[] = [
      { id: "x", inStock: false, options: [{ option_id: TALLE, value: "XL" }] },
    ]
    expect(isValueAvailable(soloAgotada, {}, TALLE, "XL")).toBe(true)
  })
})

describe("isValueInStock", () => {
  it("hay stock si alguna variante compatible con la selección lo tiene", () => {
    expect(isValueInStock(variants, {}, COLOR, "Negro")).toBe(true)
    expect(isValueInStock(variants, {}, COLOR, "Rosa")).toBe(true)
  })

  it("no hay stock si todas las variantes compatibles están agotadas", () => {
    // L / Negro está agotada y es la única con L y Negro.
    expect(isValueInStock(variants, { [TALLE]: "L" }, COLOR, "Negro")).toBe(false)
  })

  it("respeta lo ya elegido en las otras opciones", () => {
    expect(isValueInStock(variants, { [COLOR]: "Negro" }, TALLE, "M")).toBe(true)
    expect(isValueInStock(variants, { [COLOR]: "Negro" }, TALLE, "L")).toBe(false)
  })

  it("un valor que no existe no tiene stock", () => {
    expect(isValueInStock(variants, {}, COLOR, "Verde")).toBe(false)
  })
})

