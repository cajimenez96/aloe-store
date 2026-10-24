import { expect, test } from "@playwright/test"
import { call, freshIp, session } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

test("el descuento por transferencia no se puede usar con tarjeta ni se filtra el código", async () => {
  const seed = loadSeed()
  const { store } = await session()
  const web = { ...store, ...freshIp() }
  const cart = (await call("POST", "/store/carts", web, { region_id: seed.regionId })).json.cart
  await call("POST", `/store/carts/${cart.id}/line-items`, web, { variant_id: seed.variantId, quantity: 2 })

  const transfer = await call("POST", `/store/checkout/${cart.id}/payment-method`, web, { method: "transfer" })
  expect(transfer.json.cart.total).toBe(3600)
  const card = await call("POST", `/store/checkout/${cart.id}/payment-method`, web, { method: "card" })
  expect(card.json.cart.total).toBe(4000)
  expect(card.json.cart.discount_total).toBe(0)

  // Con tarjeta el pedido no se confirma a mano (se crea al llegar el pago) y la ruta nativa está cerrada.
  const complete = await call("POST", `/store/checkout/${cart.id}/complete`, web)
  expect(complete.json.code).toBe("CARD_PAYMENT_REQUIRED")
  const native = await call("POST", `/store/carts/${cart.id}/complete`, web)
  expect(native.json.code).toBe("ORDER_ACCESS_DENIED")

  // Probar un código adivinado a mano no da descuento.
  const guess = await call("POST", `/store/carts/${cart.id}/promotions`, web, { promo_codes: ["TRANSFERENCIA10"] })
  expect(guess.status).toBeGreaterThanOrEqual(400)

  // El código real nunca aparece en una respuesta de la tienda.
  await call("POST", `/store/checkout/${cart.id}/payment-method`, web, { method: "transfer" })
  const fields = encodeURIComponent("*promotions,*items,*items.adjustments")
  const bodies = [
    JSON.stringify(transfer.json),
    JSON.stringify((await call("GET", `/store/carts/${cart.id}?fields=${fields}`, web)).json),
    JSON.stringify((await call("GET", `/store/carts/${cart.id}`, web)).json),
  ]
  for (const body of bodies) expect(body).not.toContain(seed.promoCode)
})
