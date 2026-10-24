// Prueba de concurrencia de la última unidad (planning.md, HU-47), en k6.
// Equivale a scripts/concurrency/last-unit.mjs (que no necesita k6 instalado).
//
//   k6 run -e BACKEND_URL=http://localhost:9300 -e ADMIN_EMAIL=qa@aloe.local \
//          -e ADMIN_PASSWORD=... scripts/k6/last-unit.js
//
// Requiere el backend de PRUEBAS con TRUSTED_PROXY_HOPS=1 (para simular IPs
// distintas), la tienda configurada (npm run setup:store), datos bancarios y el
// código de la promoción cargados. 20 VUs, 1 iteración cada uno: los pares compran
// por la web (transferencia) y los impares venden en el local.
import http from "k6/http"
import { check } from "k6"
import { Counter } from "k6/metrics"

const BASE = __ENV.BACKEND_URL || "http://localhost:9300"
const succeeded = new Counter("last_unit_succeeded")

export const options = {
  scenarios: { last_unit: { executor: "per-vu-iterations", vus: 20, iterations: 1, maxDuration: "2m" } },
  thresholds: { last_unit_succeeded: ["count==1"] },
}

const json = (headers) => ({ headers: { "Content-Type": "application/json", ...headers } })
const post = (path, body, headers) => http.post(BASE + path, JSON.stringify(body), json(headers))
const get = (path, headers) => http.get(BASE + path, json(headers))

export function setup() {
  const login = post("/auth/user/emailpass", { email: __ENV.ADMIN_EMAIL, password: __ENV.ADMIN_PASSWORD })
  const admin = { Authorization: `Bearer ${login.json("token")}` }
  const key = get("/admin/api-keys?type=publishable", admin).json("api_keys").find((k) => k.title === "Tienda web").token
  const channels = get("/admin/sales-channels", admin).json("sales_channels")
  const location = get("/admin/stock-locations", admin).json("stock_locations").find((l) => l.name === "Local")
  const profile = get("/admin/shipping-profiles", admin).json("shipping_profiles")[0]
  const region = get("/admin/regions", admin).json("regions")[0]
  const sku = `ULT-${Date.now()}`

  const product = post(
    "/admin/products",
    {
      title: `Ultima unidad ${sku}`,
      status: "published",
      sales_channels: channels.filter((c) => c.name === "Web" || c.name === "Local").map((c) => ({ id: c.id })),
      shipping_profile_id: profile.id,
      options: [{ title: "Talle", values: ["U"] }],
      variants: [{ title: "U", sku, manage_inventory: true, options: { Talle: "U" }, prices: [{ amount: 1000, currency_code: "ars" }] }],
    },
    admin
  ).json("product")
  const item = get("/admin/inventory-items?limit=100", admin).json("inventory_items").find((i) => i.sku === sku)
  post(`/admin/inventory-items/${item.id}/location-levels`, { location_id: location.id, stocked_quantity: 1 }, admin)

  return { admin, key, regionId: region.id, variantId: product.variants[0].id, itemId: item.id }
}

export default function (data) {
  const publishable = { "x-publishable-api-key": data.key }
  const n = __VU

  if (n % 2 === 1) {
    // Local: venta en el punto de venta.
    const sale = post("/admin/pos/sales", { items: [{ variant_id: data.variantId, quantity: 1 }], payment_method: "cash" }, data.admin)
    if (check(sale, { "venta del local concretada": (r) => r.status === 201 })) succeeded.add(1)
    return
  }

  // Web: carrito, entrega, transferencia y confirmación.
  const forwarded = { "x-forwarded-for": `10.9.${n}.${n}` }
  const cart = post("/store/carts", { region_id: data.regionId }, { ...publishable, ...forwarded }).json("cart")
  const added = post(`/store/carts/${cart.id}/line-items`, { variant_id: data.variantId, quantity: 1 }, publishable)
  if (added.status >= 400) return
  const option = get(`/store/shipping-options?cart_id=${cart.id}`, publishable).json("shipping_options").find((o) => o.name.indexOf("Retiro") === 0)
  post(`/store/carts/${cart.id}`, { email: `conc${n}@ejemplo.com`, shipping_address: { first_name: "Prueba", last_name: String(n), country_code: "ar", phone: "1155550000" } }, publishable)
  post(`/store/carts/${cart.id}/shipping-methods`, { option_id: option.id }, publishable)
  post(`/store/checkout/${cart.id}/payment-method`, { method: "transfer" }, publishable)
  const done = post(`/store/checkout/${cart.id}/complete`, {}, { ...publishable, ...forwarded })
  if (check(done, { "compra web concretada": (r) => r.status === 200 })) succeeded.add(1)
}

export function teardown(data) {
  const level = get(`/admin/inventory-items/${data.itemId}?fields=id,location_levels.stocked_quantity,location_levels.reserved_quantity`, data.admin).json("inventory_item").location_levels[0]
  const stocked = Number(level.stocked_quantity)
  const reserved = Number(level.reserved_quantity)
  console.log(`stock fisico=${stocked} reservado=${reserved} disponible=${stocked - reserved}`)
  if (stocked < 0 || reserved < 0 || stocked - reserved < 0) throw new Error("El stock quedó negativo")
}
