import { expect, test } from "@playwright/test"
import { PNG, proofsOf, session, call } from "../helpers/api"
import { buyOnStorefront, orderIdFromUrl } from "../helpers/storefront"

test("compra por transferencia: sube el comprobante, el admin lo acepta y el pedido queda pagado", async ({ page }) => {
  await buyOnStorefront(page, `acepta-${Date.now()}@ejemplo.com`)
  const orderId = orderIdFromUrl(page.url())

  // Datos para pagar
  await expect(page.getByText("Monto exacto", { exact: true })).toBeVisible()
  await expect(page.getByText("Referencia", { exact: true })).toBeVisible()
  await expect(page.getByText("Pendiente de pago")).toBeVisible()

  // Sube el comprobante
  await page.locator("#proof-file").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG("e2e-aceptada") })
  await page.getByRole("button", { name: "Subir comprobante" }).click()
  await expect(page.getByText("lo estamos revisando")).toBeVisible()
  await expect(page.locator("#proof-file")).toHaveCount(0)

  // El admin lo acepta
  const { admin } = await session()
  const [proof] = await proofsOf(orderId)
  expect(proof.status).toBe("pending_review")
  const accepted = await call("POST", `/admin/transfer-proofs/${proof.id}/accept`, admin, {})
  expect(accepted.status).toBe(200)

  // Pagado, sin datos bancarios
  await page.reload()
  await expect(page.getByText("Pagado")).toBeVisible()
  await expect(page.getByText("Cómo pagar")).toHaveCount(0)
  const order = (await call("GET", `/admin/orders/${orderId}?fields=id,payment_status`, admin)).json.order
  expect(order.payment_status).toBe("captured")
})
