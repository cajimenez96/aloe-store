import fs from "node:fs"
import path from "node:path"
import { call, session, type Seed } from "./helpers/api"
import { SENTINELS } from "./helpers/env"

/**
 * Prepara los datos del escenario sobre el backend de pruebas: datos bancarios, la
 * promoción de transferencia y un producto con stock en los canales Web y Local.
 */
export default async function globalSetup() {
  const { admin, store } = await session()
  // Idempotente: si el entorno ya está sembrado (por ejemplo al depurar) se reutiliza.
  const current = (await call("GET", "/admin/store-settings", admin)).json.settings ?? {}
  let promoCode: string = current.transfer_promotion_code
  if (!promoCode) {
    promoCode = "Trf" + Array.from({ length: 20 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("")
    await call("POST", "/admin/promotions", admin, {
      code: promoCode,
      type: "standard",
      status: "active",
      is_automatic: false,
      application_method: { type: "percentage", target_type: "order", allocation: "across", value: 10, currency_code: "ars" },
    })
  }
  const settings = await call("PATCH", "/admin/store-settings", admin, {
    transfer_promotion_code: promoCode,
    admin_notification_email: "duenio@aloe.com",
    transfer_reservation_hours: 24,
    bank_account: { holder: SENTINELS.holder, cbu: SENTINELS.cbu, alias: "alias.reservado", bank: "Banco Reservado" },
  })
  if (settings.status !== 200) throw new Error(`No se pudo configurar el comercio: ${JSON.stringify(settings.json)}`)

  const channels = (await call("GET", "/admin/sales-channels", admin)).json.sales_channels
  const location = (await call("GET", "/admin/stock-locations", admin)).json.stock_locations.find((l: any) => l.name === "Local")
  const profile = (await call("GET", "/admin/shipping-profiles", admin)).json.shipping_profiles[0]
  const region = (await call("GET", "/admin/regions", admin)).json.regions[0]

  let product = (await call("GET", "/admin/products?handle=pijama-e2e&fields=id,*variants", admin)).json.products?.[0]
  let sku: string = product?.variants?.[0]?.sku
  if (!product) {
    sku = `E2E-${Date.now()}`
    product = (
      await call("POST", "/admin/products", admin, {
        title: "Pijama E2E",
        handle: "pijama-e2e",
        status: "published",
        sales_channels: channels.filter((c: any) => c.name === "Web" || c.name === "Local").map((c: any) => ({ id: c.id })),
        shipping_profile_id: profile.id,
        options: [{ title: "Talle", values: ["M"] }],
        variants: [{ title: "M", sku, manage_inventory: true, options: { Talle: "M" }, prices: [{ amount: 2000, currency_code: "ars" }] }],
      })
    ).json.product
    if (!product) throw new Error("No se pudo crear el producto de prueba.")
    const item = (await call("GET", "/admin/inventory-items?limit=100", admin)).json.inventory_items.find((i: any) => i.sku === sku)
    await call("POST", `/admin/inventory-items/${item.id}/location-levels`, admin, { location_id: location.id, stocked_quantity: 500 })
  }

  // Un producto con una sola unidad para el caso de la última unidad con tarjeta.
  let last = (await call("GET", "/admin/products?handle=ultima-e2e&fields=id,*variants", admin)).json.products?.[0]
  if (!last) {
    const lastSku = `ULT-${Date.now()}`
    last = (
      await call("POST", "/admin/products", admin, {
        title: "Ultima unidad E2E",
        handle: "ultima-e2e",
        status: "published",
        sales_channels: channels.filter((c: any) => c.name === "Web").map((c: any) => ({ id: c.id })),
        shipping_profile_id: profile.id,
        options: [{ title: "Talle", values: ["U"] }],
        variants: [{ title: "U", sku: lastSku, manage_inventory: true, options: { Talle: "U" }, prices: [{ amount: 2000, currency_code: "ars" }] }],
      })
    ).json.product
    const lastItem = (await call("GET", "/admin/inventory-items?limit=100", admin)).json.inventory_items.find((i: any) => i.sku === lastSku)
    await call("POST", `/admin/inventory-items/${lastItem.id}/location-levels`, admin, { location_id: location.id, stocked_quantity: 1 })
  }

  const seed: Seed = { variantId: product.variants[0].id, sku, promoCode, regionId: region.id, lastVariantId: last.variants[0].id }
  fs.writeFileSync(path.join(__dirname, ".seed.json"), JSON.stringify(seed))
  void store
}
