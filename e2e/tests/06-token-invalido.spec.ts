import { expect, test } from "@playwright/test"
import { call, createTransferOrder, session } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

test("un token inválido no revela si el pedido existe", async ({ page }) => {
  const seed = loadSeed()
  const { store } = await session()
  const order = await createTransferOrder(seed, `token-${Date.now()}@ejemplo.com`)

  // Por la API: token malo, sin token, pedido inexistente y token de otro pedido dan la misma respuesta.
  const other = await createTransferOrder(seed, `token2-${Date.now()}@ejemplo.com`)
  const attempts = [
    await call("GET", `/store/order-access/${order.orderId}`, { ...store, "x-order-token": "x".repeat(43) }),
    await call("GET", `/store/order-access/${order.orderId}`, store),
    await call("GET", `/store/order-access/order_01NOEXISTE00000000000000`, { ...store, "x-order-token": order.token }),
    await call("GET", `/store/order-access/${order.orderId}`, { ...store, "x-order-token": other.token }),
  ]
  for (const attempt of attempts) {
    expect(attempt.status).toBe(404)
    expect(attempt.json.code).toBe("ORDER_ACCESS_DENIED")
    expect(attempt.json).toEqual(attempts[0].json)
  }
  expect((await call("GET", `/store/order-access/${order.orderId}`, { ...store, "x-order-token": order.token })).status).toBe(200)

  // Las rutas nativas de pedidos están cerradas.
  expect((await call("GET", `/store/orders/${order.orderId}`, store)).json.code).toBe("ORDER_ACCESS_DENIED")

  // En el navegador: enlace con token malo, y el correcto entra y deja la URL sin el token.
  await page.context().clearCookies()
  await page.goto(`/pedido/${order.orderId}/acceso?token=${"x".repeat(43)}`)
  await expect(page.getByText("No encontramos ese pedido")).toBeVisible()
  await expect(page.getByText("Cómo pagar")).toHaveCount(0)

  await page.goto(`/pedido/${order.orderId}/acceso?token=${order.token}`)
  await expect(page.getByText("Cómo pagar")).toBeVisible()
  expect(page.url()).not.toContain("token")
  const cookie = (await page.context().cookies()).find((c) => c.name.startsWith("aloe_order_"))!
  expect(cookie.httpOnly).toBe(true)
  expect(cookie.sameSite).toBe("Lax")
})
