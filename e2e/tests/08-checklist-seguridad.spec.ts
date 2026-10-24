import { expect, test } from "@playwright/test"
import { BACKEND, STOREFRONT } from "../helpers/env"
import { call, createTransferOrder, proofsOf, session, uploadProof } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

// Ítems de seguridad.md, sección 6.1, que se pueden comprobar de forma automática.

test("CORS con orígenes exactos", async () => {
  const { store } = await session()
  const withOrigin = async (origin: string, path = "/store/regions", headers: Record<string, string> = store) => {
    const response = await fetch(BACKEND + path, { headers: { ...headers, Origin: origin } })
    return response.headers.get("access-control-allow-origin")
  }
  expect(await withOrigin(STOREFRONT)).toBe(STOREFRONT)
  for (const origin of ["https://evil.example", `${STOREFRONT}.evil.example`, "http://localhost:3101", "null"]) {
    expect(await withOrigin(origin), origin).toBeNull()
  }
  // El panel también: solo su propio origen.
  expect(await withOrigin("https://evil.example", "/auth/user/emailpass")).toBeNull()
})

test("el storefront manda los encabezados de seguridad (sin HSTS) en todas las respuestas", async () => {
  for (const route of ["/productos", "/carrito", "/checkout", "/terminos", "/no-existe", "/pedido/order_x/acceso?token=" + "a".repeat(43)]) {
    const response = await fetch(STOREFRONT + route, { redirect: "manual" })
    const csp = response.headers.get("content-security-policy") ?? ""
    expect(csp, route).toContain("default-src 'self'")
    expect(csp, route).toContain("frame-ancestors 'none'")
    expect(csp, route).toContain("object-src 'none'")
    expect(csp, route).not.toMatch(/(^|[\s;])\*([\s;]|$)/)
    expect(response.headers.get("x-content-type-options"), route).toBe("nosniff")
    expect(response.headers.get("referrer-policy"), route).toBe("strict-origin-when-cross-origin")
    expect(response.headers.get("x-frame-options"), route).toBe("DENY")
    expect(response.headers.get("permissions-policy"), route).toContain("camera=()")
    expect(response.headers.get("strict-transport-security"), route).toBeNull()
  }
})

test("comprobantes: fuera de static, sin sesión no se abren y el enlace alterado o ajeno se rechaza", async () => {
  const seed = loadSeed()
  const { admin } = await session()
  const order = await createTransferOrder(seed, `comprobante-${Date.now()}@ejemplo.com`)
  expect((await uploadProof(order.orderId, order.token)).status).toBe(201)
  const [proof] = await proofsOf(order.orderId)
  const link: string = proof.file_url

  // Con sesión y enlace vigente se entrega con los encabezados de SEC-51.
  const ok = await fetch(BACKEND + link, { headers: admin })
  expect(ok.status).toBe(200)
  expect(ok.headers.get("content-disposition")).toContain("attachment")
  expect(ok.headers.get("x-content-type-options")).toBe("nosniff")
  expect(ok.headers.get("cache-control")).toBe("no-store")
  expect(ok.headers.get("content-security-policy")).toBe("sandbox")

  // Sin sesión, con el enlace alterado o con el de otro comprobante: no.
  expect((await fetch(BACKEND + link)).status).toBe(401)
  expect((await fetch(BACKEND + link.replace(/.$/, link.endsWith("0") ? "1" : "0"), { headers: admin })).status).toBe(403)
  const other = await createTransferOrder(seed, `comprobante2-${Date.now()}@ejemplo.com`)
  await uploadProof(other.orderId, other.token)
  const [otherProof] = await proofsOf(other.orderId)
  const crossed = `/admin/transfer-proofs/${otherProof.id}/file?token=${link.split("token=")[1]}`
  expect((await fetch(BACKEND + crossed, { headers: admin })).status).toBe(403)

  // El archivo no está en la carpeta pública de Medusa.
  expect((await fetch(`${BACKEND}/static/${proof.id}`)).status).toBe(404)
  expect(await call("GET", "/admin/transfer-proofs", {})).toMatchObject({ status: 401 })

  // El vendedor ve la cola pero no revisa.
  expect(proof.status).toBe("pending_review")
})
