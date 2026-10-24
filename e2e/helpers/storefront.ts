import { expect, type Page } from "@playwright/test"
import { SENTINELS } from "./env"

/** Compra por transferencia desde el navegador, hasta llegar a la página del pedido. */
export async function buyOnStorefront(page: Page, email: string, opts: { sentinels?: boolean } = {}) {
  await page.context().clearCookies()
  await page.goto("/productos/pijama-e2e")
  await page.getByRole("button", { name: "Agregar al carrito" }).waitFor()
  await page.locator("label").filter({ hasText: /^M$/ }).click()
  await page.getByRole("button", { name: "Agregar al carrito" }).click()
  await expect(page.getByText("Agregado al carrito.")).toBeVisible()

  await page.goto("/checkout")
  await page.getByText("Medio de pago").waitFor()
  await page.getByLabel("Nombre y apellido").fill(opts.sentinels ? SENTINELS.name : "Cliente Prueba")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Teléfono").fill(opts.sentinels ? SENTINELS.phone : "1155550000")
  if (opts.sentinels) await page.getByLabel("Documento").fill(SENTINELS.document)
  await page.getByRole("radio", { name: /Retiro en el local/ }).check()
  await page.getByRole("button", { name: "Guardar datos" }).click()
  await expect(page.getByText("Datos guardados.")).toBeVisible()

  await page.getByRole("radio", { name: /Transferencia/ }).check()
  await expect(page.getByText(/Total con transferencia/)).toBeVisible()
  // El texto sale del estado del navegador; el resumen cambia recién cuando el servidor guardó el medio de pago.
  await expect(page.locator("aside")).toContainText("1.800")
  await page.reload()
  await page.getByText("Medio de pago").waitFor()
  await page.getByRole("button", { name: "Confirmar pedido" }).click()
  await page.waitForURL("**/pedido/**")
  await expect(page.getByText("Cómo pagar")).toBeVisible()
  return page.url().split("/pedido/")[1]
}

export const orderIdFromUrl = (url: string) => url.split("/pedido/")[1].split(/[/?]/)[0]
