import { checkCartItems, CartLimitError } from "../check"

const variant = (over: Record<string, unknown> = {}) => ({
  id: "var_1",
  published: true,
  manageInventory: true,
  allowBackorder: false,
  available: 10,
  ...over,
})

function run(input: Partial<Parameters<typeof checkCartItems>[0]> = {}) {
  try {
    checkCartItems({
      maxUnits: 5,
      existing: [],
      incoming: [{ variantId: "var_1", quantity: 1 }],
      variants: { var_1: variant() },
      ...input,
    })
    return null
  } catch (error) {
    return error as CartLimitError
  }
}

describe("checkCartItems", () => {
  it("acepta una cantidad dentro del máximo y del stock", () => {
    expect(run()).toBeNull()
  })

  it("supera el máximo por variante sumando lo que ya está en el carrito", () => {
    const error = run({
      existing: [{ variantId: "var_1", quantity: 4 }],
      incoming: [{ variantId: "var_1", quantity: 2 }],
    })
    expect(error).toMatchObject({ code: "MAX_UNITS_EXCEEDED" })
    expect(error?.details).toMatchObject({ max_units_per_variant: 5 })
  })

  it("llegar justo al máximo es válido", () => {
    expect(
      run({ existing: [{ variantId: "var_1", quantity: 4 }], incoming: [{ variantId: "var_1", quantity: 1 }] })
    ).toBeNull()
  })

  it("sin stock suficiente informa la cantidad disponible", () => {
    const error = run({
      variants: { var_1: variant({ available: 2 }) },
      incoming: [{ variantId: "var_1", quantity: 3 }],
    })
    expect(error).toMatchObject({ code: "STOCK_INSUFFICIENT" })
    expect(error?.details).toMatchObject({ variant_id: "var_1", available: 2 })
  })

  it("con reserva permitida o sin gestión de inventario no mira el stock", () => {
    expect(run({ variants: { var_1: variant({ available: 0, allowBackorder: true }) } })).toBeNull()
    expect(run({ variants: { var_1: variant({ available: 0, manageInventory: false }) } })).toBeNull()
  })

  it("una variante despublicada o inexistente no está disponible", () => {
    const cases: Record<string, ReturnType<typeof variant>>[] = [
      { var_1: variant({ published: false }) },
      {},
    ]
    for (const variants of cases) {
      expect(run({ variants })).toMatchObject({ code: "VARIANT_UNAVAILABLE" })
    }
  })

  it("cantidades inválidas se rechazan", () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      expect(run({ incoming: [{ variantId: "var_1", quantity }] })).toBeInstanceOf(CartLimitError)
    }
  })
})
