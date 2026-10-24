import { expect, test } from "@playwright/test"
import { ADMIN_EMAIL, ADMIN_PASSWORD, BACKEND } from "../helpers/env"

// HU-32: el listado nativo de Medusa no filtra por estado de pago; la pantalla "Pedidos" sí.
test("pedidos: se filtran por estado de pago y por canal", async ({ page }) => {
  await page.goto(`${BACKEND}/app/login`)
  await page.getByRole("textbox", { name: "Email" }).fill(ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await page.waitForURL((url) => !url.pathname.includes("login"))

  await page.goto(`${BACKEND}/app/pedidos`)
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible()
  const badges = () => page.locator("tbody tr td:nth-child(5)").allInnerTexts()
  const channels = () => page.locator("tbody tr td:nth-child(3)").allInnerTexts()

  await expect.poll(async () => (await badges()).length).toBeGreaterThan(0)
  const everything = await badges()
  expect(new Set(everything).size).toBeGreaterThan(1) // hay pedidos pagados y sin pagar

  await page.getByLabel("Estado de pago").click()
  await page.getByRole("option", { name: "Pagado" }).click()
  await expect.poll(async () => (await badges()).every((text) => text === "Pagado") && (await badges()).length > 0).toBe(true)

  await page.getByLabel("Estado de pago").click()
  await page.getByRole("option", { name: "Sin pagar" }).click()
  await expect.poll(async () => (await badges()).length > 0 && (await badges()).every((text) => text === "Sin pagar")).toBe(true)

  await page.getByLabel("Estado de pago").click()
  await page.getByRole("option", { name: "Todos" }).click()
  await page.getByLabel("Canal").click()
  await page.getByRole("option", { name: "Local" }).click()
  await expect.poll(async () => (await channels()).length > 0 && (await channels()).every((text) => text === "Local")).toBe(true)
})
