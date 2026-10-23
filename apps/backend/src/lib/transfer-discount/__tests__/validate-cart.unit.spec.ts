import type { MedusaContainer } from "@medusajs/framework/types"
import { MANUAL_PROVIDER_ID } from "../guard"
import { resetTransferCodeCache } from "../secret"
import { validateDiscountPayment } from "../validate-cart"

const SECRET = "TRF-9f3k2m8x7q1w"

function containerWith(options: { secret: string | null; promoCodes: string[]; providers: string[] }) {
  const graph = jest.fn(async ({ entity }: { entity: string }) =>
    entity === "store"
      ? { data: [{ id: "store_1", metadata: { transfer_promotion_code: options.secret } }] }
      : {
          data: [
            {
              id: "cart_1",
              promotions: options.promoCodes.map((code) => ({ code })),
              payment_collection: {
                payment_sessions: options.providers.map((provider_id) => ({ provider_id })),
              },
            },
          ],
        }
  )
  return { resolve: () => ({ graph }) } as unknown as MedusaContainer
}

beforeEach(() => resetTransferCodeCache())

describe("validateDiscountPayment (HU-22)", () => {
  it("intenta completar un carrito con la promoción y tarjeta, y falla con DISCOUNT_PAYMENT_MISMATCH", async () => {
    const container = containerWith({
      secret: SECRET,
      promoCodes: [SECRET],
      providers: ["pp_mercadopago_mercadopago"],
    })
    await expect(validateDiscountPayment(container, "cart_1")).rejects.toMatchObject({
      code: "DISCOUNT_PAYMENT_MISMATCH",
    })
  })

  it("deja completar la promoción con el proveedor manual", async () => {
    const container = containerWith({ secret: SECRET, promoCodes: [SECRET], providers: [MANUAL_PROVIDER_ID] })
    await expect(validateDiscountPayment(container, "cart_1")).resolves.toBeUndefined()
  })

  it("deja completar con tarjeta si el carrito no tiene la promoción", async () => {
    const container = containerWith({ secret: SECRET, promoCodes: [], providers: ["pp_mercadopago_mercadopago"] })
    await expect(validateDiscountPayment(container, "cart_1")).resolves.toBeUndefined()
  })

  it("sin código configurado no bloquea nada", async () => {
    const container = containerWith({ secret: null, promoCodes: [SECRET], providers: ["pp_x"] })
    await expect(validateDiscountPayment(container, "cart_1")).resolves.toBeUndefined()
  })

  it("el mensaje del rechazo no contiene el código", async () => {
    const container = containerWith({ secret: SECRET, promoCodes: [SECRET], providers: ["pp_x"] })
    await expect(validateDiscountPayment(container, "cart_1")).rejects.toThrow(/^(?!.*TRF-9f3k).*$/)
  })
})
