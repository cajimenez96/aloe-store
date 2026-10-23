import fs from "node:fs"
import path from "node:path"
import { decide, SUPERADMIN_ONLY_WRITE } from "../policy"

/**
 * Prueba por ruta y por rol (planning.md, HU-38): recorre TODAS las rutas de
 * /admin que existen hoy, las de Medusa y las propias, y comprueba la decisión
 * de cada rol. Si una actualización de Medusa agrega una ruta, esta prueba la
 * incluye sola, y el vendedor la tiene denegada salvo que se la habilite acá.
 */

type AdminRoute = { method: string; path: string }

const VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

function routeFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return routeFiles(full)
    }
    return /^route\.(js|ts)$/.test(entry.name) && !full.endsWith(".d.ts")
      ? [full]
      : []
  })
}

function discover(baseDir: string, urlPrefix: string, ext: RegExp): AdminRoute[] {
  return routeFiles(baseDir).flatMap((file) => {
    const relative = path.relative(baseDir, path.dirname(file))
    const urlPath =
      urlPrefix +
      (relative ? "/" + relative.split(path.sep).join("/") : "")
    const normalized = urlPath.replace(/\[([^\]]+)\]/g, "x_$1")
    const source = fs.readFileSync(file, "utf8")
    return VERBS.filter((verb) =>
      new RegExp(`exports\\.${verb}\\s*=|export\\s+(async\\s+)?function\\s+${verb}\\b|export\\s+const\\s+${verb}\\b`).test(
        source
      )
    ).map((method) => ({ method, path: normalized }))
  })
}

const medusaAdminDir = path.dirname(
  require.resolve("@medusajs/medusa/package.json")
)
const nativeRoutes = discover(
  path.join(medusaAdminDir, "dist/api/admin"),
  "/admin",
  /route\.js$/
)
const ownRoutes = discover(
  path.resolve(__dirname, "../../../api/admin"),
  "/admin",
  /route\.ts$/
)
const allRoutes: AdminRoute[] = [
  ...nativeRoutes,
  ...ownRoutes,
  // Rutas de la configuración pendiente (HU-29, HU-31, HU-34, HU-37): se
  // incluyen para que su política quede fijada antes de implementarlas.
  { method: "GET", path: "/admin/transfer-proofs" },
  { method: "GET", path: "/admin/transfer-proofs/x_id/url" },
  { method: "GET", path: "/admin/transfer-proofs/x_id/file" },
  { method: "POST", path: "/admin/transfer-proofs/x_id/accept" },
  { method: "POST", path: "/admin/transfer-proofs/x_id/reject" },
  { method: "GET", path: "/admin/store-settings" },
  { method: "PATCH", path: "/admin/store-settings" },
  { method: "POST", path: "/admin/pos/sales" },
  { method: "GET", path: "/admin/pos/sales/summary" },
]

const key = (r: AdminRoute) => `${r.method} ${r.path}`

describe("política de roles sobre todas las rutas de /admin", () => {
  it("encuentra las rutas de Medusa (la prueba no puede quedar vacía)", () => {
    expect(nativeRoutes.length).toBeGreaterThan(150)
    expect(allRoutes.map(key)).toContain("GET /admin/products")
    expect(allRoutes.map(key)).toContain("POST /admin/api-keys")
  })

  it("el superadmin puede usar todas", () => {
    const denied = allRoutes.filter((r) => !decide("superadmin", r.method, r.path))
    expect(denied.map(key)).toEqual([])
  })

  it("el admin puede usar todas, salvo modificar lo que es del superadmin", () => {
    const denied = allRoutes
      .filter((r) => !decide("admin", r.method, r.path))
      .map(key)
    const expected = allRoutes
      .filter(
        (r) =>
          r.method !== "GET" && SUPERADMIN_ONLY_WRITE.some((rule) => rule.test(r.path))
      )
      .map(key)
    expect(denied.sort()).toEqual(expected.sort())
    expect(expected.length).toBeGreaterThan(5)
  })

  it("el admin no modifica regiones, impuestos, proveedores de pago ni claves de API", () => {
    for (const r of allRoutes.filter((x) => x.method !== "GET")) {
      if (
        /^\/admin\/(regions|tax-regions|tax-rates|tax-providers|api-keys|price-preferences|users)(\/|$)/.test(r.path) ||
        /^\/admin\/payments\/payment-providers/.test(r.path)
      ) {
        expect({ route: key(r), allowed: decide("admin", r.method, r.path) }).toEqual({
          route: key(r),
          allowed: false,
        })
      }
    }
  })

  it("el vendedor tiene permitidas exactamente estas rutas, y todas las demás denegadas", () => {
    const allowed = allRoutes
      .filter((r) => decide("vendedor", r.method, r.path))
      .map(key)
      .sort()

    // Ninguna escritura salvo registrar una venta.
    const writes = allowed.filter((k) => !k.startsWith("GET "))
    expect(writes).toEqual(["POST /admin/pos/sales"])

    // Lectura: solo catálogo, stock, pedidos, comprobantes y su propio usuario.
    const reads = allowed.filter((k) => k.startsWith("GET "))
    for (const read of reads) {
      expect(read).toMatch(
        /^GET \/admin\/(products|product-categories|inventory-items|stock-locations|orders|transfer-proofs)(\/|$)|^GET \/admin\/users\/me$/
      )
    }
    expect(reads.length).toBeGreaterThan(5)
  })

  it("el vendedor no puede nada de lo sensible", () => {
    const sensitive = [
      /^\/admin\/users(\/(?!me$)|$)/,
      /^\/admin\/invites/,
      /^\/admin\/api-keys/,
      /^\/admin\/regions/,
      /^\/admin\/tax-/,
      /^\/admin\/promotions/,
      /^\/admin\/campaigns/,
      /^\/admin\/price-lists/,
      /^\/admin\/payments/,
      /^\/admin\/payment-collections/,
      /^\/admin\/refund-reasons/,
      /^\/admin\/uploads/,
      /^\/admin\/stores/,
      /^\/admin\/store-settings/,
      /^\/admin\/sales-channels/,
      /^\/admin\/shipping-/,
      /^\/admin\/fulfillment/,
    ]
    const leaked = allRoutes
      .filter((r) => sensitive.some((s) => s.test(r.path)))
      .filter((r) => decide("vendedor", r.method, r.path))
      .map(key)
    expect(leaked).toEqual([])
  })

  it("una ruta de Medusa que no se conoce hoy queda denegada para el vendedor", () => {
    expect(decide("vendedor", "GET", "/admin/futura-ruta")).toBe(false)
    expect(decide("vendedor", "POST", "/admin/futura-ruta")).toBe(false)
  })
})
