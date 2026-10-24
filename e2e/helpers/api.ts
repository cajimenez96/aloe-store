import { execFileSync } from "node:child_process"
import path from "node:path"
import { BACKEND, ADMIN_EMAIL, ADMIN_PASSWORD, SENTINELS } from "./env"

type Json = Record<string, any>
export type Reply = { status: number; json: Json }

export async function call(method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Reply> {
  const response = await fetch(BACKEND + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, json: (await response.json().catch(() => ({}))) as Json }
}

let cached: { admin: Record<string, string>; store: Record<string, string> } | null = null

/** Sesión de admin y clave publicable de la tienda (una vez por proceso). */
export async function session() {
  if (cached) return cached
  const token = (await call("POST", "/auth/user/emailpass", {}, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).json.token
  const admin = { Authorization: `Bearer ${token}` }
  const key = (await call("GET", "/admin/api-keys?type=publishable", admin)).json.api_keys.find((k: Json) => k.title === "Tienda web").token
  cached = { admin, store: { "x-publishable-api-key": key } }
  return cached
}

export type Seed = { variantId: string; sku: string; promoCode: string; regionId: string }

/** Una IP distinta por llamada evita que los límites por IP afecten a los escenarios. */
let counter = Math.floor(Math.random() * 200) + 20
export const freshIp = () => ({ "x-forwarded-for": `10.${counter}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` })

export const PNG = (marker: string) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`${marker}-${Math.random()}`)])

/** Crea un pedido por transferencia por la API, hasta confirmarlo. Devuelve su id y el token. */
export async function createTransferOrder(seed: Seed, email: string, opts: { quantity?: number; sentinels?: boolean } = {}) {
  const { store } = await session()
  const web = { ...store, ...freshIp() }
  const cart = (await call("POST", "/store/carts", web, { region_id: seed.regionId })).json.cart
  await call("POST", `/store/carts/${cart.id}/line-items`, web, { variant_id: seed.variantId, quantity: opts.quantity ?? 1 })
  const option = (await call("GET", `/store/shipping-options?cart_id=${cart.id}`, web)).json.shipping_options.find((o: Json) => o.name.startsWith("Retiro"))
  await call("POST", `/store/carts/${cart.id}`, web, {
    email,
    shipping_address: opts.sentinels
      ? { first_name: "Zulema", last_name: "Quintana", phone: SENTINELS.phone, address_1: SENTINELS.street, city: "Ciudad Reservada", country_code: "ar" }
      : { first_name: "Prueba", last_name: "E2E", phone: "1155550000", country_code: "ar" },
    metadata: opts.sentinels ? { customer_document: SENTINELS.document } : {},
  })
  await call("POST", `/store/carts/${cart.id}/shipping-methods`, web, { option_id: option.id })
  const method = await call("POST", `/store/checkout/${cart.id}/payment-method`, web, { method: "transfer" })
  const done = await call("POST", `/store/checkout/${cart.id}/complete`, web)
  if (done.status !== 200) throw new Error(`No se pudo crear el pedido: ${done.status} ${JSON.stringify(done.json)} (medio de pago ${method.status})`)
  return { cartId: cart.id as string, orderId: done.json.order_id as string, token: done.json.token as string, total: method.json.cart?.total as number }
}

export async function uploadProof(orderId: string, token: string, content: Buffer = PNG("e2e")) {
  const { store } = await session()
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(content)], { type: "image/png" }), "comprobante.png")
  const response = await fetch(`${BACKEND}/store/order-access/${orderId}/transfer-proofs`, {
    method: "POST",
    headers: { ...store, "x-order-token": token, ...freshIp() },
    body: form,
  })
  return { status: response.status, json: (await response.json().catch(() => ({}))) as Json }
}

export async function proofsOf(orderId: string) {
  const { admin } = await session()
  return (await call("GET", `/admin/transfer-proofs?status=all&order_id=${orderId}`, admin)).json.transfer_proofs as Json[]
}

/** Corre el job de vencimiento del build compilado, en un proceso aparte (como `medusa exec`). */
export function runExpiryJob() {
  const dir = process.env.E2E_BACKEND_DIR
  if (!dir) throw new Error("Falta E2E_BACKEND_DIR (carpeta .medusa/server del backend).")
  const probe = path.join(__dirname, "..", "probes", "expire-job.cjs")
  try {
    execFileSync("npx", ["medusa", "exec", probe], { cwd: dir, env: process.env, stdio: "pipe" })
  } catch (error) {
    const output = error as { stdout?: Buffer; stderr?: Buffer }
    throw new Error(`Falló el job de vencimiento:\n${String(output.stdout ?? "").slice(-1500)}\n${String(output.stderr ?? "").slice(-1500)}`)
  }
}
