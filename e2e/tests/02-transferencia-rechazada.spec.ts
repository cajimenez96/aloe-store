import { expect, test } from "@playwright/test"
import { PNG, call, proofsOf, session } from "../helpers/api"
import { buyOnStorefront, orderIdFromUrl } from "../helpers/storefront"

test("rechazo del comprobante: el cliente ve el motivo, sube otro y queda pagado", async ({ page }) => {
  await buyOnStorefront(page, `rechaza-${Date.now()}@ejemplo.com`)
  const orderId = orderIdFromUrl(page.url())
  const { admin } = await session()

  await page.locator("#proof-file").setInputFiles({ name: "uno.png", mimeType: "image/png", buffer: PNG("e2e-rechazo-1") })
  await page.getByRole("button", { name: "Subir comprobante" }).click()
  await expect(page.getByText("lo estamos revisando")).toBeVisible()

  const [first] = await proofsOf(orderId)
  const short = await call("POST", `/admin/transfer-proofs/${first.id}/reject`, admin, { reason: "corto" })
  expect(short.status).toBe(422)
  expect(short.json.code).toBe("REJECTION_REASON_REQUIRED")
  const rejected = await call("POST", `/admin/transfer-proofs/${first.id}/reject`, admin, { reason: "El monto del comprobante no coincide con el pedido." })
  expect(rejected.status).toBe(200)
  expect((await call("POST", `/admin/transfer-proofs/${first.id}/accept`, admin, {})).json.code).toBe("TRANSFER_PROOF_NOT_REVIEWABLE")

  await page.reload()
  await expect(page.getByText(/Rechazamos tu comprobante/)).toBeVisible()
  await expect(page.getByText(/El monto del comprobante no coincide/)).toBeVisible()
  await expect(page.locator("#proof-file")).toBeVisible()

  await page.locator("#proof-file").setInputFiles({ name: "dos.png", mimeType: "image/png", buffer: PNG("e2e-rechazo-2") })
  await page.getByRole("button", { name: "Subir comprobante" }).click()
  await expect(page.getByText("lo estamos revisando")).toBeVisible()

  const second = (await proofsOf(orderId)).find((p) => p.status === "pending_review")!
  expect((await call("POST", `/admin/transfer-proofs/${second.id}/accept`, admin, {})).status).toBe(200)
  await page.reload()
  await expect(page.getByText("Pagado")).toBeVisible()
})
