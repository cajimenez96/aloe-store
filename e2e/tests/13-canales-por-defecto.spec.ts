import { expect, test } from "@playwright/test"
import { call, session } from "../helpers/api"

test("un producto creado sin canales queda publicado en Web y Local", async () => {
  const { admin } = await session()
  const profile = (await call("GET", "/admin/shipping-profiles", admin)).json.shipping_profiles[0]
  const created = await call("POST", "/admin/products", admin, {
    title: `Sin canales ${Date.now()}`,
    status: "draft",
    shipping_profile_id: profile.id,
    options: [{ title: "Talle", values: ["U"] }],
    variants: [{ title: "U", manage_inventory: false, options: { Talle: "U" }, prices: [{ amount: 1000, currency_code: "ars" }] }],
  })
  expect(created.status).toBe(200)

  const fetched = await call("GET", `/admin/products/${created.json.product.id}?fields=id,*sales_channels`, admin)
  const names = (fetched.json.product.sales_channels as { name: string }[]).map((channel) => channel.name).sort()
  expect(names).toEqual(["Local", "Web"])

  await call("DELETE", `/admin/products/${created.json.product.id}`, admin)
})

test("un canal elegido por el admin no se pierde al sumar los de por defecto", async () => {
  const { admin } = await session()
  const profile = (await call("GET", "/admin/shipping-profiles", admin)).json.shipping_profiles[0]
  const channels = (await call("GET", "/admin/sales-channels", admin)).json.sales_channels as { id: string; name: string }[]
  const web = channels.find((channel) => channel.name === "Web")!
  const created = await call("POST", "/admin/products", admin, {
    title: `Solo web ${Date.now()}`,
    status: "draft",
    shipping_profile_id: profile.id,
    sales_channels: [{ id: web.id }],
    options: [{ title: "Talle", values: ["U"] }],
    variants: [{ title: "U", manage_inventory: false, options: { Talle: "U" }, prices: [{ amount: 1000, currency_code: "ars" }] }],
  })
  expect(created.status).toBe(200)
  const fetched = await call("GET", `/admin/products/${created.json.product.id}?fields=id,*sales_channels`, admin)
  expect((fetched.json.product.sales_channels as { name: string }[]).map((c) => c.name).sort()).toEqual(["Local", "Web"])
  await call("DELETE", `/admin/products/${created.json.product.id}`, admin)
})
