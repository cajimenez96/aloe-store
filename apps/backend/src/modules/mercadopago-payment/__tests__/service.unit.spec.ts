import { MercadoPagoPaymentService } from "../service"

type Reply = { status: number; body: unknown }
function setup(replies: Reply[], extra: Record<string, unknown> = {}) {
  const calls: { url: string; body: any }[] = []
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const next = replies.shift() ?? { status: 200, body: {} }
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "content-type": "application/json" } })
  }) as unknown as typeof fetch
  const service = new MercadoPagoPaymentService({}, { accessToken: "TEST-x", apiBase: "http://sim.local", fetchImpl, ...extra })
  return { service, calls }
}

const initData = { session_id: "payses_01ABC" }

describe("MercadoPagoPaymentService", () => {
  it("rechaza la configuración sin token", () => {
    expect(() => MercadoPagoPaymentService.validateOptions({})).toThrow(/MP_ACCESS_TOKEN/)
    expect(() => MercadoPagoPaymentService.validateOptions({ accessToken: "x" })).not.toThrow()
  })

  it("al iniciar crea la preferencia con el total de Medusa y deja el enlace de pago", async () => {
    const { service, calls } = setup([{ status: 201, body: { id: "pref_1", init_point: "http://sim.local/pay/pref_1" } }])
    const result = await service.initiatePayment({ amount: 1800, currency_code: "ars", data: initData } as never)
    expect(calls[0].body.items[0]).toMatchObject({ unit_price: 1800, currency_id: "ARS" })
    expect(calls[0].body.external_reference).toBe("payses_01ABC")
    expect(calls[0].body).not.toHaveProperty("notification_url")
    expect(result).toMatchObject({
      id: "pref_1",
      status: "pending",
      data: { init_point: "http://sim.local/pay/pref_1", external_reference: "payses_01ABC", expected_amount: 1800, expected_currency: "ARS" },
    })
  })

  it("con URLs configuradas las manda a Mercado Pago", async () => {
    const { service, calls } = setup([{ status: 201, body: { id: "p", init_point: "x" } }], {
      notificationUrl: "https://x.test/hooks/mercadopago",
      backUrlBase: "https://tienda.test/pago/volver",
    })
    await service.initiatePayment({ amount: 100, currency_code: "ars", data: initData } as never)
    expect(calls[0].body.notification_url).toBe("https://x.test/hooks/mercadopago")
    expect(calls[0].body.back_urls.success).toBe("https://tienda.test/pago/volver")
  })

  it("si Mercado Pago no responde informa PAYMENT_PROVIDER_UNAVAILABLE", async () => {
    const { service } = setup([{ status: 503, body: {} }])
    await expect(service.initiatePayment({ amount: 100, currency_code: "ars", data: initData } as never)).rejects.toMatchObject({
      code: "PAYMENT_PROVIDER_UNAVAILABLE",
    })
  })

  it("sin id de sesión no inicia", async () => {
    const { service } = setup([])
    await expect(service.initiatePayment({ amount: 100, currency_code: "ars", data: {} } as never)).rejects.toThrow()
  })

  const session = { external_reference: "payses_01ABC", expected_amount: 1800, expected_currency: "ARS" }
  const payment = (over: Record<string, unknown> = {}) => ({
    id: 555,
    status: "approved",
    transaction_amount: 1800,
    currency_id: "ARS",
    external_reference: "payses_01ABC",
    date_created: "2026-10-25T10:00:00Z",
    ...over,
  })

  it("autoriza (cobra) un pago aprobado y guarda el id de Mercado Pago", async () => {
    const { service } = setup([{ status: 200, body: { results: [payment()] } }])
    expect(await service.authorizePayment({ data: session } as never)).toMatchObject({ status: "captured", data: { mp_payment_id: "555" } })
  })

  it("un pago aprobado con otro monto no se cobra", async () => {
    const { service } = setup([{ status: 200, body: { results: [payment({ transaction_amount: 1 })] } }])
    expect((await service.authorizePayment({ data: session } as never)).status).toBe("error")
  })

  it("pendiente, rechazado, reembolsado y sin pagos devuelven su estado", async () => {
    for (const [status, expected] of [["in_process", "pending"], ["rejected", "error"], ["refunded", "canceled"]] as const) {
      const { service } = setup([{ status: 200, body: { results: [payment({ status })] } }])
      expect((await service.getPaymentStatus({ data: session } as never)).status).toBe(expected)
    }
    const empty = setup([{ status: 200, body: { results: [] } }])
    expect((await empty.service.getPaymentStatus({ data: session } as never)).status).toBe("pending")
  })

  it("reembolsa por la API de Mercado Pago con el id guardado", async () => {
    const { service, calls } = setup([{ status: 201, body: { id: 1 } }])
    await service.refundPayment({ amount: 500, data: { mp_payment_id: "555" } } as never)
    expect(calls[0].url).toBe("http://sim.local/v1/payments/555/refunds")
    expect(calls[0].body).toEqual({ amount: 500 })
    await expect(setup([]).service.refundPayment({ amount: 500, data: {} } as never)).rejects.toThrow()
  })

  it("si el total no cambió al actualizar, no crea otra preferencia", async () => {
    const { service, calls } = setup([])
    const result = await service.updatePayment({ amount: 1800, currency_code: "ars", data: { ...session, preference_id: "pref_1" } } as never)
    expect(calls).toHaveLength(0)
    expect(result.status).toBe("pending")
  })

  it("si el total cambió crea una preferencia nueva con el monto nuevo", async () => {
    const { service, calls } = setup([{ status: 201, body: { id: "pref_2", init_point: "http://sim.local/pay/pref_2" } }])
    const result = await service.updatePayment({ amount: 1620, currency_code: "ars", data: { ...session, preference_id: "pref_1" } } as never)
    expect(calls[0].body.items[0].unit_price).toBe(1620)
    expect(result.data).toMatchObject({ preference_id: "pref_2", expected_amount: 1620 })
  })

  it("las notificaciones no se procesan por el webhook nativo de Medusa", async () => {
    expect(await setup([]).service.getWebhookActionAndData({} as never)).toEqual({ action: "not_supported" })
  })
})
