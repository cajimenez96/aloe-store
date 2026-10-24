import { buildPreference } from "../preference"

const base = { reference: "payses_01ABC", title: "Pedido Aloe", total: 1800, currency: "ars" }

describe("buildPreference (HU-24)", () => {
  it("lleva un solo ítem con el total que calculó Medusa y la referencia propia", () => {
    const pref = buildPreference(base)
    expect(pref.external_reference).toBe("payses_01ABC")
    expect(pref.items).toEqual([{ title: "Pedido Aloe", quantity: 1, unit_price: 1800, currency_id: "ARS" }])
  })

  it("sin URLs configuradas no incluye back_urls, auto_return ni notification_url", () => {
    const pref = buildPreference(base)
    expect(pref).not.toHaveProperty("back_urls")
    expect(pref).not.toHaveProperty("auto_return")
    expect(pref).not.toHaveProperty("notification_url")
  })

  it("con URLs configuradas las agrega", () => {
    const pref = buildPreference({ ...base, notificationUrl: "https://x.ngrok.app/hooks/mercadopago", backUrlBase: "https://tienda.test/pago/volver" })
    expect(pref.notification_url).toBe("https://x.ngrok.app/hooks/mercadopago")
    expect(pref.back_urls).toEqual({
      success: "https://tienda.test/pago/volver",
      pending: "https://tienda.test/pago/volver",
      failure: "https://tienda.test/pago/volver",
    })
    expect(pref.auto_return).toBe("approved")
  })

  it("ignora URLs que no son http(s) (no se manda texto arbitrario a Mercado Pago)", () => {
    const pref = buildPreference({ ...base, notificationUrl: "javascript:alert(1)", backUrlBase: "no es una url" })
    expect(pref).not.toHaveProperty("notification_url")
    expect(pref).not.toHaveProperty("back_urls")
  })

  it("redondea el total a dos decimales y rechaza totales inválidos", () => {
    expect(buildPreference({ ...base, total: 1800.456 }).items[0].unit_price).toBe(1800.46)
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildPreference({ ...base, total: bad })).toThrow()
    }
  })
})
