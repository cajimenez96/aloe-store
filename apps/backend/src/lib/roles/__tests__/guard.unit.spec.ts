import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { enforceRole } from "../guard"

type Fakes = {
  req: MedusaRequest
  res: MedusaResponse
  next: jest.Mock
  warn: jest.Mock
  status: jest.Mock
  json: jest.Mock
  resJson: jest.Mock
}

function setup(options: {
  method: string
  url: string
  auth?: { actor_id?: string; actor_type?: string } | undefined
  user?: { id: string; metadata?: unknown } | Error
}): Fakes {
  const warn = jest.fn()
  const retrieveUser = jest.fn(async () => {
    if (options.user instanceof Error) {
      throw options.user
    }
    return options.user
  })
  const json = jest.fn()
  const status = jest.fn(() => ({ json }))
  const resJson = jest.fn()
  const req = {
    method: options.method,
    originalUrl: options.url,
    auth_context: options.auth,
    scope: {
      resolve: (key: string) => (key === "logger" ? { warn } : { retrieveUser }),
    },
  } as unknown as MedusaRequest
  const res = { status, json: resJson } as unknown as MedusaResponse
  return { req, res, next: jest.fn(), warn, status, json, resJson }
}

const asUser = (id = "user_1") => ({ actor_id: id, actor_type: "user" })

describe("enforceRole", () => {
  it("deja pasar una solicitud sin autenticar: la rechaza la autenticación de Medusa", async () => {
    const f = setup({ method: "GET", url: "/admin/users", auth: undefined })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).toHaveBeenCalledTimes(1)
    expect(f.status).not.toHaveBeenCalled()
  })

  it("no interviene con actores que no son usuarios (claves de API)", async () => {
    const f = setup({
      method: "GET",
      url: "/admin/products",
      auth: { actor_id: "apk_1", actor_type: "api-key" },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).toHaveBeenCalledTimes(1)
  })

  it("un vendedor consulta productos", async () => {
    const f = setup({
      method: "GET",
      url: "/admin/products?limit=10",
      auth: asUser(),
      user: { id: "user_1", metadata: { role: "vendedor" } },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).toHaveBeenCalledTimes(1)
    expect(f.warn).not.toHaveBeenCalled()
  })

  it("un vendedor no puede ver los usuarios: 403 ROLE_NOT_ALLOWED y queda registrado", async () => {
    const f = setup({
      method: "GET",
      url: "/admin/users",
      auth: asUser("user_9"),
      user: { id: "user_9", metadata: { role: "vendedor" } },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).not.toHaveBeenCalled()
    expect(f.status).toHaveBeenCalledWith(403)
    expect(f.json).toHaveBeenCalledWith(
      expect.objectContaining({ type: "not_allowed", code: "ROLE_NOT_ALLOWED" })
    )
    expect(f.warn).toHaveBeenCalledTimes(1)
    const logged = JSON.parse(f.warn.mock.calls[0][0])
    expect(logged).toMatchObject({
      event: "role_denied",
      user_id: "user_9",
      role: "vendedor",
      method: "GET",
      path: "/admin/users",
    })
  })

  it("el registro de rechazos no incluye la query ni datos personales", async () => {
    const f = setup({
      method: "GET",
      url: "/admin/users?email=ana@ejemplo.com",
      auth: asUser(),
      user: { id: "user_1", metadata: { role: "vendedor", email: "x" } },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.warn.mock.calls[0][0]).not.toContain("ana@ejemplo.com")
    expect(f.warn.mock.calls[0][0]).not.toContain("email")
  })

  it("un usuario sin rol se trata como vendedor", async () => {
    const f = setup({
      method: "POST",
      url: "/admin/promotions",
      auth: asUser(),
      user: { id: "user_1", metadata: null },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.status).toHaveBeenCalledWith(403)
  })

  it("el admin puede crear productos pero no modificar regiones", async () => {
    const ok = setup({
      method: "POST",
      url: "/admin/products",
      auth: asUser(),
      user: { id: "user_1", metadata: { role: "admin" } },
    })
    await enforceRole(ok.req, ok.res, ok.next)
    expect(ok.next).toHaveBeenCalledTimes(1)

    const denied = setup({
      method: "POST",
      url: "/admin/regions/reg_1",
      auth: asUser(),
      user: { id: "user_1", metadata: { role: "admin" } },
    })
    await enforceRole(denied.req, denied.res, denied.next)
    expect(denied.status).toHaveBeenCalledWith(403)
  })

  it("el superadmin puede modificar regiones", async () => {
    const f = setup({
      method: "POST",
      url: "/admin/regions/reg_1",
      auth: asUser(),
      user: { id: "user_1", metadata: { role: "superadmin" } },
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).toHaveBeenCalledTimes(1)
  })

  it("si no se puede leer el usuario, deniega (falla cerrado)", async () => {
    const f = setup({
      method: "GET",
      url: "/admin/products",
      auth: asUser(),
      user: new Error("base de datos caída"),
    })
    await enforceRole(f.req, f.res, f.next)
    expect(f.next).not.toHaveBeenCalled()
    expect(f.status).toHaveBeenCalledWith(403)
  })

  describe("metadata de la tienda", () => {
    const storeBody = () => ({
      stores: [
        {
          id: "store_1",
          name: "Aloe",
          metadata: {
            bank_account: { cbu: "0123456789012345678901" },
            transfer_promotion_code: "k3J9x2Qv7LmP4aRt8WzB",
          },
        },
      ],
    })

    it("al vendedor se le quita la metadata de la tienda: tiene el CBU y el código de la promoción", async () => {
      const f = setup({
        method: "GET",
        url: "/admin/stores?fields=*",
        auth: asUser(),
        user: { id: "user_1", metadata: { role: "vendedor" } },
      })
      await enforceRole(f.req, f.res, f.next)
      expect(f.next).toHaveBeenCalledTimes(1)

      f.res.json(storeBody() as never)
      const sent = JSON.stringify(f.resJson.mock.calls[0][0])
      expect(sent).toContain("Aloe")
      expect(sent).not.toContain("metadata")
      expect(sent).not.toContain("0123456789012345678901")
      expect(sent).not.toContain("k3J9x2Qv7LmP4aRt8WzB")
    })

    it("también la quita cuando la ruta se escribe con mayúsculas", async () => {
      const f = setup({
        method: "GET",
        url: "/ADMIN/Stores",
        auth: asUser(),
        user: { id: "user_1", metadata: { role: "vendedor" } },
      })
      await enforceRole(f.req, f.res, f.next)
      f.res.json(storeBody() as never)
      expect(JSON.stringify(f.resJson.mock.calls[0][0])).not.toContain("k3J9x2Qv7LmP4aRt8WzB")
    })

    it("al admin no se le quita nada", async () => {
      const f = setup({
        method: "GET",
        url: "/admin/stores",
        auth: asUser(),
        user: { id: "user_1", metadata: { role: "admin" } },
      })
      await enforceRole(f.req, f.res, f.next)
      f.res.json(storeBody() as never)
      expect(JSON.stringify(f.resJson.mock.calls[0][0])).toContain("k3J9x2Qv7LmP4aRt8WzB")
    })
  })
})
