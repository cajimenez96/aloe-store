import { MercadoPagoClient, MpApiError, MpUnavailableError } from "../client"

type Call = { url: string; init: RequestInit }

function fakeFetch(responses: { status: number; body?: unknown }[]) {
  const calls: Call[] = []
  const impl = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const next = responses.shift() ?? { status: 200, body: {} }
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: { "content-type": "application/json" } })
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

const make = (responses: { status: number; body?: unknown }[], extra: Partial<ConstructorParameters<typeof MercadoPagoClient>[0]> = {}) => {
  const f = fakeFetch(responses)
  return { client: new MercadoPagoClient({ accessToken: "TEST-token-secreto", baseUrl: "http://sim.local", fetchImpl: f.impl, ...extra }), calls: f.calls }
}

describe("MercadoPagoClient", () => {
  it("crea la preferencia con el token en el encabezado y devuelve el enlace de pago", async () => {
    const { client, calls } = make([{ status: 201, body: { id: "pref_1", init_point: "http://sim.local/pay/pref_1" } }])
    const result = await client.createPreference({ external_reference: "ref", items: [] } as never, "key-1")
    expect(result).toMatchObject({ id: "pref_1", init_point: "http://sim.local/pay/pref_1" })
    expect(calls[0].url).toBe("http://sim.local/checkout/preferences")
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer TEST-token-secreto")
    expect(headers["X-Idempotency-Key"]).toBe("key-1")
    expect(calls[0].init.method).toBe("POST")
  })

  it("consulta un pago por id", async () => {
    const { client, calls } = make([{ status: 200, body: { id: 555, status: "approved", transaction_amount: 1800 } }])
    expect(await client.getPayment("555")).toMatchObject({ status: "approved", transaction_amount: 1800 })
    expect(calls[0].url).toBe("http://sim.local/v1/payments/555")
  })

  it("rechaza ids de pago que no sean alfanuméricos (no arma rutas con texto del exterior)", async () => {
    const { client, calls } = make([])
    await expect(client.getPayment("../../admin")).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it("busca pagos por referencia y los devuelve del más nuevo al más viejo", async () => {
    const { client, calls } = make([{ status: 200, body: { results: [{ id: 1, date_created: "2026-10-25T10:00:00Z" }, { id: 2, date_created: "2026-10-25T11:00:00Z" }] } }])
    const found = await client.searchPayments("payses_01ABC")
    expect(found.map((p) => p.id)).toEqual([2, 1])
    expect(calls[0].url).toContain("external_reference=payses_01ABC")
  })

  it("un error 4xx se informa sin repetir el token", async () => {
    const { client } = make([{ status: 401, body: { message: "invalid access token" } }])
    const error = await client.getPayment("1").catch((e) => e)
    expect(error).toBeInstanceOf(MpApiError)
    expect(error.status).toBe(401)
    expect(String(error.message)).not.toContain("TEST-token-secreto")
  })

  it("un 5xx o una falla de red es MpUnavailableError, para ofrecer pagar por transferencia", async () => {
    const { client } = make([{ status: 503 }])
    await expect(client.getPayment("1")).rejects.toBeInstanceOf(MpUnavailableError)

    const failing = new MercadoPagoClient({ accessToken: "t", baseUrl: "http://x", fetchImpl: (async () => { throw new Error("ECONNREFUSED") }) as unknown as typeof fetch })
    await expect(failing.getPayment("1")).rejects.toBeInstanceOf(MpUnavailableError)
  })

  it("un tiempo de espera agotado es MpUnavailableError", async () => {
    const slow = (async (_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("abort", "AbortError"))))) as unknown as typeof fetch
    const client = new MercadoPagoClient({ accessToken: "t", baseUrl: "http://x", fetchImpl: slow, timeoutMs: 20 })
    await expect(client.getPayment("1")).rejects.toBeInstanceOf(MpUnavailableError)
  })

  it("reembolsa un pago, total o parcial", async () => {
    const { client, calls } = make([{ status: 201, body: { id: 9 } }, { status: 201, body: { id: 10 } }])
    await client.refund("555", undefined, "k1")
    await client.refund("555", 100, "k2")
    expect(calls[0].url).toBe("http://sim.local/v1/payments/555/refunds")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({})
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ amount: 100 })
  })

  it("sin token configurado falla antes de llamar", () => {
    expect(() => new MercadoPagoClient({ accessToken: "" })).toThrow(/MP_ACCESS_TOKEN/)
  })
})
