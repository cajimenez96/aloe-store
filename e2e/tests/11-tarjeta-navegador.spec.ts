import { expect, test } from "@playwright/test"
import { SIMULATOR } from "../helpers/env"
import { sim } from "../helpers/api"

async function fillCheckout(page: import("@playwright/test").Page, email: string) {
  await page.context().clearCookies()
  await page.goto("/productos/pijama-e2e")
  await page.getByRole("button", { name: "Agregar al carrito" }).waitFor()
  await page.locator("label").filter({ hasText: /^M$/ }).click()
  await page.getByRole("button", { name: "Agregar al carrito" }).click()
  await expect(page.getByText("Agregado al carrito.")).toBeVisible()

  await page.goto("/checkout")
  await page.getByText("Medio de pago").waitFor()
  await page.getByLabel("Nombre y apellido").fill("Cliente Tarjeta")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Teléfono").fill("1155550000")
  await page.getByRole("radio", { name: /Retiro en el local/ }).check()
  await page.getByRole("button", { name: "Guardar datos" }).click()
  await expect(page.getByText("Datos guardados.")).toBeVisible()

  // La Server Action es un POST a la misma ruta: se espera su respuesta antes de recargar.
  const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/checkout")
  await page.getByRole("radio", { name: /Tarjeta/ }).check()
  await saved
  await expect(page.getByText(/Total con tarjeta/)).toBeVisible()
  await page.reload()
  await page.getByText("Medio de pago").waitFor()
}

test("compra con tarjeta: paga en Mercado Pago, vuelve, se verifica y queda el pedido pagado", async ({ page }) => {
  await fillCheckout(page, `tarjeta-${Date.now()}@ejemplo.com`)

  // Tarjeta: el botón es "Pagar con tarjeta" y lleva al sitio de Mercado Pago (el simulador).
  await expect(page.getByRole("button", { name: "Confirmar pedido" })).toHaveCount(0)
  await page.getByRole("button", { name: "Pagar con tarjeta" }).click()
  await page.waitForURL(`${SIMULATOR}/pay/**`)
  await expect(page.getByText("Mercado Pago · simulador")).toBeVisible()

  await page.getByRole("button", { name: "Aprobar el pago" }).click()
  await expect(page.getByText("Ya podés volver a la tienda")).toBeVisible()

  // Vuelve a mano (sin URL pública no hay redirección automática) y verifica.
  await page.goto("/pago/volver")
  await page.waitForURL("**/pedido/**")
  await expect(page.getByText("Pagado")).toBeVisible()
  await expect(page.getByText("Cómo pagar")).toHaveCount(0)
  expect(page.url()).not.toContain("token")
})

test("compra con tarjeta rechazada: vuelve al checkout con el aviso y puede pagar por transferencia", async ({ page }) => {
  await fillCheckout(page, `rechazada-${Date.now()}@ejemplo.com`)
  await page.getByRole("button", { name: "Pagar con tarjeta" }).click()
  await page.waitForURL(`${SIMULATOR}/pay/**`)
  await page.getByRole("button", { name: "Rechazar el pago" }).click()

  await page.goto("/pago/volver")
  await page.waitForURL("**/checkout?pago=rechazado")
  await expect(page.getByText(/Mercado Pago no aprobó el pago/)).toBeVisible()
  await expect(page.getByRole("radio", { name: /Transferencia/ })).toBeVisible()

  // Sin pago aprobado, "verificar" no inventa nada.
  const state = (await sim("GET", "/__sim/state")).json
  expect(state.payments.at(-1).status).toBe("rejected")
})

test("verificar el pago antes de pagar espera, sin crear nada", async ({ page }) => {
  await fillCheckout(page, `espera-${Date.now()}@ejemplo.com`)
  await page.getByRole("button", { name: "Pagar con tarjeta" }).click()
  await page.waitForURL(`${SIMULATOR}/pay/**`)
  await page.goto("/pago/volver")
  await page.waitForURL("**/pago/pendiente")
  await expect(page.getByText("Todavía no vemos tu pago")).toBeVisible()
})
