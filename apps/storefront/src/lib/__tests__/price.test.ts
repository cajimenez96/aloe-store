import { describe, expect, it } from "vitest"
import { formatPrice, transferPrice } from "../price"

// Normaliza el espacio de no ruptura que usa Intl entre el símbolo y el número.
const plain = (value: string) => value.replace(/ /g, " ")

describe("formatPrice", () => {
  it("formatea pesos argentinos sin decimales cuando el monto es entero", () => {
    expect(plain(formatPrice(1500, "ars"))).toBe("$ 1.500")
    expect(plain(formatPrice(0, "ars"))).toBe("$ 0")
    expect(plain(formatPrice(1234567, "ARS"))).toBe("$ 1.234.567")
  })

  it("muestra dos decimales cuando el monto tiene centavos (Medusa no redondea)", () => {
    expect(plain(formatPrice(1350.5, "ars"))).toBe("$ 1.350,50")
    expect(plain(formatPrice(99.99, "ars"))).toBe("$ 99,99")
  })

  it("los montos están en la unidad de la moneda, no en centavos", () => {
    expect(plain(formatPrice(15, "ars"))).toBe("$ 15")
  })
})

describe("transferPrice", () => {
  it("aplica el porcentaje de descuento al precio de lista", () => {
    expect(transferPrice(10000, 10)).toBe(9000)
    expect(transferPrice(1500, 20)).toBe(1200)
  })

  it("no redondea: conserva los centavos que calcula Medusa", () => {
    expect(transferPrice(1999, 15)).toBeCloseTo(1699.15, 2)
  })

  it("sin descuento devuelve el precio de lista", () => {
    expect(transferPrice(1500, 0)).toBe(1500)
  })

  it("un porcentaje fuera de 0 a 100 no se aplica", () => {
    expect(transferPrice(1500, -5)).toBe(1500)
    expect(transferPrice(1500, 101)).toBe(1500)
    expect(transferPrice(1500, Number.NaN)).toBe(1500)
  })
})
