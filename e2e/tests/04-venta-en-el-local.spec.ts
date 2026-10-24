import { expect, test } from "@playwright/test"
import { call, session } from "../helpers/api"
import { BACKEND, SELLER_EMAIL, SELLER_PASSWORD } from "../helpers/env"

test("punto de venta: el vendedor registra una venta, el stock baja y el admin la ve en el cierre", async ({ page }) => {
  const { admin } = await session()
  const stockOf = async () => {
    const items = (await call("GET", "/admin/inventory-items?limit=100&fields=id,sku,location_levels.stocked_quantity", admin)).json.inventory_items
    const item = items.find((i: any) => String(i.sku).startsWith("E2E-"))
    return Number(item.location_levels[0].stocked_quantity)
  }
  const before = await stockOf()

  await page.goto(`${BACKEND}/app/login`)
  await page.getByRole("textbox", { name: "Email" }).fill(SELLER_EMAIL)
  await page.getByPlaceholder("Password").fill(SELLER_PASSWORD)
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await page.waitForURL((url) => !url.pathname.includes("login"))

  await page.goto(`${BACKEND}/app/punto-de-venta`)
  await page.getByLabel("Buscar producto o SKU").fill("pijama")
  await page.getByRole("button", { name: /^M · / }).click()
  await page.getByRole("button", { name: /^M · / }).click()
  await page.getByRole("button", { name: "Tarjeta" }).click()
  await page.getByRole("button", { name: "Registrar venta" }).click()
  await expect(page.getByRole("heading", { name: /Venta #\d+ registrada/ })).toBeVisible()

  expect(await stockOf()).toBe(before - 2)

  const day = await call("GET", "/admin/pos/sales", admin)
  expect(day.status).toBe(200)
  expect(day.json.totals.card).toBeGreaterThanOrEqual(4000)
  expect(day.json.sales.some((sale: any) => sale.payment_method === "card" && sale.user === SELLER_EMAIL)).toBe(true)

  // El vendedor no ve el cierre de caja.
  const sellerToken = (await call("POST", "/auth/user/emailpass", {}, { email: SELLER_EMAIL, password: SELLER_PASSWORD })).json.token
  expect((await call("GET", "/admin/pos/sales", { Authorization: `Bearer ${sellerToken}` })).json.code).toBe("ROLE_NOT_ALLOWED")
})
