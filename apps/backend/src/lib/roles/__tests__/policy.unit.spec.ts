import { decide, resolveRole, ROLES } from "../policy"

describe("resolveRole", () => {
  it("toma el rol de metadata.role", () => {
    expect(resolveRole({ role: "superadmin" })).toBe("superadmin")
    expect(resolveRole({ role: "admin" })).toBe("admin")
    expect(resolveRole({ role: "vendedor" })).toBe("vendedor")
  })

  it("un usuario sin rol, con rol desconocido o con metadata inválida es vendedor", () => {
    expect(resolveRole(undefined)).toBe("vendedor")
    expect(resolveRole(null)).toBe("vendedor")
    expect(resolveRole({})).toBe("vendedor")
    expect(resolveRole({ role: "root" })).toBe("vendedor")
    expect(resolveRole({ role: ["admin"] })).toBe("vendedor")
    expect(resolveRole({ role: "ADMIN" })).toBe("vendedor")
  })
})

describe("decide: superadmin", () => {
  it("puede todo", () => {
    expect(decide("superadmin", "POST", "/admin/regions")).toBe(true)
    expect(decide("superadmin", "DELETE", "/admin/api-keys/apk_1")).toBe(true)
    expect(decide("superadmin", "POST", "/admin/ruta-que-no-existe")).toBe(true)
  })
})

describe("decide: admin", () => {
  it("opera el negocio", () => {
    expect(decide("admin", "POST", "/admin/products")).toBe(true)
    expect(decide("admin", "POST", "/admin/promotions")).toBe(true)
    expect(decide("admin", "GET", "/admin/orders")).toBe(true)
    expect(decide("admin", "POST", "/admin/invites")).toBe(true)
  })

  it("puede leer, pero no modificar, regiones, impuestos, proveedores de pago y claves de API (SEC-22)", () => {
    for (const path of [
      "/admin/regions",
      "/admin/regions/reg_1",
      "/admin/tax-regions",
      "/admin/tax-rates/txr_1",
      "/admin/tax-providers",
      "/admin/payments/payment-providers",
      "/admin/api-keys",
      "/admin/api-keys/apk_1/sales-channels",
      "/admin/price-preferences",
    ]) {
      expect(decide("admin", "GET", path)).toBe(true)
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(decide("admin", method, path)).toBe(false)
      }
    }
  })

  it("no puede modificar usuarios: el rol vive en su metadata y se ascendería a sí mismo", () => {
    expect(decide("admin", "GET", "/admin/users")).toBe(true)
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(decide("admin", method, "/admin/users/user_1")).toBe(false)
    }
    // Invitar sí: el invitado nace como vendedor.
    expect(decide("admin", "POST", "/admin/invites")).toBe(true)
  })

  it("no puede modificar la tienda de Medusa", () => {
    expect(decide("admin", "GET", "/admin/stores")).toBe(true)
    expect(decide("admin", "POST", "/admin/stores/store_1")).toBe(false)
  })
})

describe("decide: vendedor", () => {
  it("registra ventas en el local", () => {
    expect(decide("vendedor", "POST", "/admin/pos/sales")).toBe(true)
  })

  it("consulta productos, stock, pedidos y comprobantes sin modificarlos", () => {
    for (const path of [
      "/admin/products",
      "/admin/products/prod_1",
      "/admin/product-categories",
      "/admin/inventory-items",
      "/admin/inventory-items/iitem_1/location-levels",
      "/admin/stock-locations",
      "/admin/orders",
      "/admin/orders/order_1",
      "/admin/transfer-proofs",
      "/admin/transfer-proofs/tp_1/url",
    ]) {
      expect(decide("vendedor", "GET", path)).toBe(true)
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(decide("vendedor", method, path)).toBe(false)
      }
    }
  })

  it("puede consultar su propio usuario (el panel lo necesita)", () => {
    expect(decide("vendedor", "GET", "/admin/users/me")).toBe(true)
  })

  it("no accede a configuración, precios, usuarios ni claves", () => {
    for (const [method, path] of [
      ["GET", "/admin/users"],
      ["GET", "/admin/users/user_1"],
      ["POST", "/admin/users/user_1"],
      ["GET", "/admin/invites"],
      ["POST", "/admin/invites"],
      ["GET", "/admin/api-keys"],
      ["GET", "/admin/promotions"],
      ["POST", "/admin/promotions"],
      ["GET", "/admin/price-lists"],
      ["GET", "/admin/store-settings"],
      ["PATCH", "/admin/store-settings"],
      ["GET", "/admin/pos/sales/summary"],
      ["POST", "/admin/transfer-proofs/tp_1/accept"],
      ["POST", "/admin/transfer-proofs/tp_1/reject"],
      ["POST", "/admin/uploads"],
      ["POST", "/admin/orders/order_1/cancel"],
      ["POST", "/admin/payments/pay_1/refund"],
    ] as const) {
      expect({ method, path, allowed: decide("vendedor", method, path) }).toEqual({
        method,
        path,
        allowed: false,
      })
    }
  })

  it("deniega por defecto una ruta nueva o desconocida", () => {
    expect(decide("vendedor", "GET", "/admin/ruta-nueva")).toBe(false)
    expect(decide("vendedor", "POST", "/admin/otra/cosa")).toBe(false)
  })

  it("no se deja engañar por barras finales, mayúsculas del método, query ni prefijos parecidos", () => {
    expect(decide("vendedor", "get", "/admin/products/")).toBe(true)
    expect(decide("vendedor", "GET", "/admin/products?limit=5")).toBe(true)
    expect(decide("vendedor", "GET", "/admin/productsx")).toBe(false)
    expect(decide("vendedor", "GET", "/admin/products/../users")).toBe(false)
    expect(decide("vendedor", "GET", "//admin/users")).toBe(false)
    expect(decide("vendedor", "GET", "/admin/products%2f..%2fusers")).toBe(false)
  })

  it("un método desconocido se deniega", () => {
    expect(decide("vendedor", "TRACE", "/admin/products")).toBe(false)
    expect(decide("vendedor", "", "/admin/products")).toBe(false)
  })
})

describe("ROLES", () => {
  it("define exactamente los tres perfiles", () => {
    expect([...ROLES]).toEqual(["superadmin", "admin", "vendedor"])
  })
})
