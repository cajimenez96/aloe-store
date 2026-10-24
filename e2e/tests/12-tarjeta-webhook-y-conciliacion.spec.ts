import { expect, test } from "@playwright/test"
import { call, chooseCard, lastReference, newCardCart, ordersCount, payInSimulator, paymentStatus, runReconcileJob, sendWebhook, session, sim, simPayments } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

test.describe.configure({ mode: "serial" })

async function approvedCart(email: string) {
  const seed = loadSeed()
  const cart = await newCardCart(seed, seed.variantId, email)
  const chosen = await chooseCard(cart)
  expect(chosen.status).toBe(200)
  const url: string = chosen.json.payment_session.redirect_url
  const reference = await lastReference()
  return { cart, url, reference }
}

test("webhook: firma inválida y vencida se rechazan; la válida crea el pedido; repetirla no duplica", async () => {
  const { cart, url, reference } = await approvedCart(`webhook-${Date.now()}@ejemplo.com`)
  await payInSimulator(url, "approve")
  const [payment] = await simPayments(reference)
  const before = await ordersCount()

  const forged = await sendWebhook(payment.id, { secret: "otro-secreto" })
  expect(forged.status).toBe(401)
  expect(forged.json.code).toBe("WEBHOOK_SIGNATURE_INVALID")
  const stale = await sendWebhook(payment.id, { ts: Date.now() - 10 * 60_000 })
  expect(stale.status).toBe(401)
  expect(await ordersCount()).toBe(before)

  const valid = await sendWebhook(payment.id)
  expect(valid.status).toBe(200)
  expect(valid.json.action).toBe("captured")
  expect(await ordersCount()).toBe(before + 1)

  const again = await sendWebhook(payment.id)
  expect(again.status).toBe(200)
  expect(again.json.action).toBe("noop")
  expect(await ordersCount()).toBe(before + 1)

  const status = await paymentStatus(cart)
  expect(status.json.status).toBe("approved")
  expect(status.json.order_id).toBeTruthy()
})

test("monto distinto: el pago no se marca como cobrado y no se crea el pedido", async () => {
  const { cart, reference } = await approvedCart(`monto-${Date.now()}@ejemplo.com`)
  const wrong = (await sim("POST", "/__sim/payments", { external_reference: reference, status: "approved", amount: 1, currency: "ARS" })).json
  const before = await ordersCount()

  const reply = await sendWebhook(wrong.id)
  expect(reply.status).toBe(200)
  expect(reply.json.action).toBe("mismatch")
  expect(await ordersCount()).toBe(before)
  const status = await paymentStatus(cart)
  expect(status.json).toMatchObject({ status: "error", code: "PAYMENT_AMOUNT_MISMATCH" })
})

test("sin webhook: el job de conciliación confirma el pago aprobado", async () => {
  const { cart, url } = await approvedCart(`concilia-${Date.now()}@ejemplo.com`)
  await payInSimulator(url, "approve")
  const before = await ordersCount()
  runReconcileJob()
  expect(await ordersCount()).toBe(before + 1)
  expect((await paymentStatus(cart)).json.status).toBe("approved")
})

test("la última unidad: el primer pago crea el pedido y el segundo se reembolsa", async () => {
  const seed = loadSeed()
  const first = await newCardCart(seed, seed.lastVariantId, `ultima1-${Date.now()}@ejemplo.com`)
  const second = await newCardCart(seed, seed.lastVariantId, `ultima2-${Date.now()}@ejemplo.com`)
  const a = await chooseCard(first)
  const refA = await lastReference()
  const b = await chooseCard(second)
  const refB = await lastReference()
  await payInSimulator(a.json.payment_session.redirect_url, "approve")
  await payInSimulator(b.json.payment_session.redirect_url, "approve")

  expect((await paymentStatus(first)).json.status).toBe("approved")
  const lost = await paymentStatus(second)
  expect(lost.json).toMatchObject({ status: "refunded", code: "STOCK_INSUFFICIENT" })
  expect((await simPayments(refB))[0].status).toBe("refunded")
  expect((await simPayments(refA))[0].status).toBe("approved")
})

test("el descuento de transferencia no pasa con tarjeta, ni armando la sesión por la API nativa", async () => {
  const seed = loadSeed()
  const cart = await newCardCart(seed, seed.variantId, `descuento-${Date.now()}@ejemplo.com`, 2)
  const card = await chooseCard(cart)
  expect(card.json.cart).toMatchObject({ total: 4000, discount_total: 0 })

  // Quien conoce el código lo aplica a mano. Medusa descarta la sesión de tarjeta (el total cambió)...
  const applied = await call("POST", `/store/carts/${cart.id}/promotions`, cart.headers, { promo_codes: [seed.promoCode] })
  expect(applied.status).toBe(200)
  expect((await call("GET", `/store/carts/${cart.id}`, cart.headers)).json.cart.total).toBe(3600)

  // ...y entonces crea la sesión de Mercado Pago por la API nativa, salteando la ruta que quita el descuento.
  const collection = (await call("POST", "/store/payment-collections", cart.headers, { cart_id: cart.id })).json.payment_collection
  const nativeSession = await call("POST", `/store/payment-collections/${collection.id}/payment-sessions`, cart.headers, { provider_id: "pp_mercadopago_mercadopago" })
  expect(nativeSession.status).toBe(200)
  const reference = await lastReference()

  // Paga los 3.600 con tarjeta: el pedido no se puede crear (DISCOUNT_PAYMENT_MISMATCH) y se reembolsa.
  const paid = (await sim("POST", "/__sim/payments", { external_reference: reference, status: "approved", amount: 3600, currency: "ARS" })).json
  const before = await ordersCount()
  const reply = await sendWebhook(paid.id)
  expect(reply.status).toBe(200)
  expect(reply.json.action).toBe("refunded_no_stock")
  expect(await ordersCount()).toBe(before)
  expect((await simPayments(reference)).find((p) => p.id === paid.id)!.status).toBe("refunded")
})
