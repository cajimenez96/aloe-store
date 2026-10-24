#!/usr/bin/env node
/**
 * Prueba de concurrencia de stock (planning.md, HU-47): 20 compras simultáneas de
 * la última unidad de una variante, mitad por la web (checkout por transferencia) y
 * mitad en el local (punto de venta). Debe concretarse una sola y el stock no puede
 * quedar negativo.
 *
 *   BACKEND_URL=http://localhost:9300 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
 *   node scripts/concurrency/last-unit.mjs
 *
 * Usa una base de pruebas, nunca la de desarrollo: crea un producto y pedidos.
 * Equivale a scripts/k6/last-unit.js (k6 no está instalado en esta máquina).
 */
import { execSync } from "node:child_process"
import fs from "node:fs"

const BASE = process.env.BACKEND_URL ?? "http://localhost:9300"
const EMAIL = process.env.ADMIN_EMAIL ?? "qa@aloe.local"
const PASSWORD = process.env.ADMIN_PASSWORD ?? "QaScratch-2026-abc"
const ATTEMPTS = Number(process.env.ATTEMPTS ?? 20)
// "mixed" (por defecto) alterna web y local; "web" o "local" corren un solo canal.
const CHANNELS = process.env.CHANNELS ?? "mixed"
// Cada corrida simula IPs propias: reutilizarlas entre corridas seguidas choca con SEC-17.
const RUN = Math.floor(Math.random() * 200) + 20

const git = (command) => {
  try {
    return execSync(command, { encoding: "utf8" }).trim()
  } catch {
    return null
  }
}

const call = async (method, path, headers = {}, body) => {
  const response = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, json: await response.json().catch(() => ({})) }
}

const token = (await call("POST", "/auth/user/emailpass", {}, { email: EMAIL, password: PASSWORD })).json.token
const admin = { Authorization: `Bearer ${token}` }
const publishable = {
  "x-publishable-api-key": (await call("GET", "/admin/api-keys?type=publishable", admin)).json.api_keys.find((k) => k.title === "Tienda web").token,
}

// --- preparación: una variante con exactamente 1 unidad, en los canales Web y Local
const channels = (await call("GET", "/admin/sales-channels", admin)).json.sales_channels
const web = channels.find((c) => c.name === "Web")
const local = channels.find((c) => c.name === "Local")
const location = (await call("GET", "/admin/stock-locations", admin)).json.stock_locations.find((l) => l.name === "Local")
const profile = (await call("GET", "/admin/shipping-profiles", admin)).json.shipping_profiles[0]
const region = (await call("GET", "/admin/regions", admin)).json.regions[0]
const sku = `ULT-${Date.now()}`

const product = (
  await call("POST", "/admin/products", admin, {
    title: `Ultima unidad ${sku}`,
    status: "published",
    sales_channels: [{ id: web.id }, { id: local.id }],
    shipping_profile_id: profile.id,
    options: [{ title: "Talle", values: ["U"] }],
    variants: [{ title: "U", sku, manage_inventory: true, options: { Talle: "U" }, prices: [{ amount: 1000, currency_code: "ars" }] }],
  })
).json.product
const variantId = product.variants[0].id
const item = (await call("GET", "/admin/inventory-items?limit=100", admin)).json.inventory_items.find((i) => i.sku === sku)
await call("POST", `/admin/inventory-items/${item.id}/location-levels`, admin, { location_id: location.id, stocked_quantity: 1 })

const settings = (await call("GET", "/admin/store-settings", admin)).json.settings
if (!settings.bank_account) throw new Error("Falta cargar los datos bancarios (PATCH /admin/store-settings) para la compra por transferencia.")

const pickup = (cartId) => call("GET", `/store/shipping-options?cart_id=${cartId}`, publishable).then((r) => r.json.shipping_options.find((o) => o.name.startsWith("Retiro")))

// --- intentos
// Cada paso previo a competir por el stock tiene que salir bien: si no, el intento
// no compitió y la corrida no prueba nada (se informa como intento inválido).
class SetupError extends Error {}
const must = (response, step) => {
  if (response.status >= 400) throw new SetupError(`${step}: ${response.status} ${response.json.code ?? response.json.message ?? ""}`)
  return response
}

const webPurchase = async (n) => {
  // Una IP distinta por intento en TODAS las llamadas, para no chocar con los límites por IP.
  const forwarded = { "x-forwarded-for": `10.${RUN}.${n}.${n}` }
  const web = { ...publishable, ...forwarded }
  try {
    const cart = must(await call("POST", "/store/carts", web, { region_id: region.id }), "crear carrito").json.cart
    const added = await call("POST", `/store/carts/${cart.id}/line-items`, web, { variant_id: variantId, quantity: 1 })
    if (added.status >= 400) return { channel: "web", ok: false, code: added.json.code ?? `${added.status} ${String(added.json.message ?? "").slice(0, 60)}`.trim(), stage: "agregar" }
    const option = (must(await call("GET", `/store/shipping-options?cart_id=${cart.id}`, web), "opciones de envio")).json.shipping_options.find((o) => o.name.startsWith("Retiro"))
    must(await call("POST", `/store/carts/${cart.id}`, web, { email: `conc${n}@ejemplo.com`, shipping_address: { first_name: "Prueba", last_name: String(n), country_code: "ar", phone: "1155550000" } }), "datos del cliente")
    must(await call("POST", `/store/carts/${cart.id}/shipping-methods`, web, { option_id: option.id }), "metodo de envio")
    must(await call("POST", `/store/checkout/${cart.id}/payment-method`, web, { method: "transfer" }), "medio de pago")
    const done = await call("POST", `/store/checkout/${cart.id}/complete`, web)
    return { channel: "web", ok: done.status === 200, code: done.json.code ?? (done.status === 200 ? "ORDER_CREATED" : `${done.status} ${String(done.json.message ?? "").slice(0, 60)}`.trim()), stage: "completar", orderId: done.json.order_id }
  } catch (error) {
    if (error instanceof SetupError) return { channel: "web", ok: false, invalid: true, code: error.message }
    throw error
  }
}
const posSale = async () => {
  const sale = await call("POST", "/admin/pos/sales", admin, { items: [{ variant_id: variantId, quantity: 1 }], payment_method: "cash" })
  return { channel: "local", ok: sale.status === 201, code: sale.json.code ?? (sale.status === 201 ? "SALE_CREATED" : `${sale.status} ${String(sale.json.message ?? "").slice(0, 60)}`.trim()), orderId: sale.json.sale?.order_id }
}

const started = Date.now()
const results = await Promise.all(Array.from({ length: ATTEMPTS }, (_, i) => (CHANNELS === "web" || (CHANNELS === "mixed" && i % 2 === 0) ? webPurchase(i + 1) : posSale())))
const elapsedMs = Date.now() - started

// --- verificación
const levels = (await call("GET", `/admin/inventory-items/${item.id}?fields=id,location_levels.stocked_quantity,location_levels.reserved_quantity,location_levels.available_quantity`, admin)).json.inventory_item.location_levels
const level = levels[0]
const succeeded = results.filter((r) => r.ok)
const invalid = results.filter((r) => r.invalid)
const failures = results.filter((r) => !r.ok && !r.invalid).reduce((acc, r) => { const key = `${r.channel}${r.stage ? "/" + r.stage : ""}: ${r.code}`; acc[key] = (acc[key] ?? 0) + 1; return acc }, {})
const stocked = Number(level.stocked_quantity)
const reserved = Number(level.reserved_quantity)

const report = {
  scenario: "ultima-unidad",
  channels: CHANNELS,
  generatedAt: new Date().toISOString(),
  gitCommit: git("git rev-parse --short HEAD"),
  workingTreeClean: git("git status --porcelain") === "",
  attempts: ATTEMPTS,
  elapsedMs,
  succeeded: succeeded.length,
  invalidAttempts: invalid.map((r) => r.code),
  succeededBy: succeeded.map((r) => r.channel),
  failures,
  inventory: { stocked, reserved, available: stocked - reserved },
  checks: {
    allAttemptsCompeted: invalid.length === 0,
    exactlyOneSucceeded: succeeded.length === 1,
    neverNegative: stocked >= 0 && reserved >= 0 && stocked - reserved >= 0,
  },
}
report.passed = Object.values(report.checks).every(Boolean)

const out = process.env.REPORT ?? `reports/concurrency-last-unit.json`
fs.mkdirSync(out.includes("/") ? out.slice(0, out.lastIndexOf("/")) : ".", { recursive: true })
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n")
console.log(JSON.stringify(report, null, 2))
process.exit(report.passed ? 0 : 1)
