import type { MpPayment } from "./payment"
import type { Preference } from "./preference"

/** Mercado Pago respondió con un error del cliente (4xx): no tiene sentido reintentar tal cual. */
export class MpApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "MpApiError"
  }
}

/** Mercado Pago no respondió: red caída, tiempo agotado o 5xx (`PAYMENT_PROVIDER_UNAVAILABLE`). */
export class MpUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MpUnavailableError"
  }
}

type Options = {
  accessToken: string
  /** Por defecto la API real; las pruebas locales apuntan al simulador (`MP_API_BASE`). */
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const ID = /^[A-Za-z0-9_-]{1,100}$/

/**
 * Cliente mínimo de la API de Mercado Pago (arquitectura.md, sección 10). Nunca
 * repite el token en los mensajes de error.
 */
export class MercadoPagoClient {
  private readonly token: string
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: Options) {
    if (!options.accessToken) throw new Error("Falta MP_ACCESS_TOKEN para usar Mercado Pago.")
    this.token = options.accessToken
    this.baseUrl = (options.baseUrl ?? "https://api.mercadopago.com").replace(/\/+$/, "")
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 8000
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      throw new MpUnavailableError("No se pudo conectar con Mercado Pago.")
    } finally {
      clearTimeout(timer)
    }

    if (response.status >= 500) throw new MpUnavailableError(`Mercado Pago respondió ${response.status}.`)
    const json = (await response.json().catch(() => ({}))) as Record<string, any>
    if (!response.ok) throw new MpApiError(response.status, `Mercado Pago rechazó la solicitud (${response.status}): ${String(json.message ?? "sin detalle").slice(0, 120)}`)
    return json as T
  }

  createPreference(preference: Preference, idempotencyKey?: string) {
    return this.request<{ id: string; init_point: string; sandbox_init_point?: string }>("POST", "/checkout/preferences", preference, idempotencyKey)
  }

  async getPayment(id: string) {
    if (!ID.test(id)) throw new MpApiError(400, "Identificador de pago inválido.")
    return this.request<MpPayment>("GET", `/v1/payments/${id}`)
  }

  /** Pagos de una referencia externa, del más nuevo al más viejo. */
  async searchPayments(reference: string): Promise<(MpPayment & { date_created?: string })[]> {
    const response = await this.request<{ results?: (MpPayment & { date_created?: string })[] }>(
      "GET",
      `/v1/payments/search?external_reference=${encodeURIComponent(reference)}&sort=date_created&criteria=desc`
    )
    return [...(response.results ?? [])].sort((a, b) => String(b.date_created ?? "").localeCompare(String(a.date_created ?? "")))
  }

  async refund(paymentId: string, amount: number | undefined, idempotencyKey?: string) {
    if (!ID.test(paymentId)) throw new MpApiError(400, "Identificador de pago inválido.")
    return this.request<{ id: number | string }>("POST", `/v1/payments/${paymentId}/refunds`, amount === undefined ? {} : { amount }, idempotencyKey)
  }
}
