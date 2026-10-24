import { AbstractPaymentProvider, MathBN, MedusaError } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { MercadoPagoClient, MpApiError, MpUnavailableError } from "../../lib/mercadopago/client"
import { evaluatePayment, mapStatus } from "../../lib/mercadopago/payment"
import { pickPayment } from "../../lib/mercadopago/decide"
import { buildPreference } from "../../lib/mercadopago/preference"

export type MercadoPagoOptions = {
  accessToken: string
  apiBase?: string
  notificationUrl?: string
  backUrlBase?: string
  /** Solo para pruebas. */
  fetchImpl?: typeof fetch
}

type SessionData = {
  preference_id?: string
  init_point?: string
  external_reference?: string
  expected_amount?: number
  expected_currency?: string
  mp_payment_id?: string
}

/**
 * Proveedor de pago de Mercado Pago (Checkout Pro) para Medusa 2.22 (arquitectura.md,
 * sección 10). La referencia externa es el id de la sesión de pago, así cada
 * notificación se puede atar a su carrito. El estado de un pago sale siempre de la
 * consulta a la API de Mercado Pago (seguridad.md, SEC-32 y SEC-33).
 */
export class MercadoPagoPaymentService extends AbstractPaymentProvider<MercadoPagoOptions> {
  static identifier = "mercadopago"

  protected client_: MercadoPagoClient
  protected options_: MercadoPagoOptions

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.accessToken) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta MP_ACCESS_TOKEN para el proveedor de Mercado Pago.")
    }
  }

  constructor(container: Record<string, unknown>, options: MercadoPagoOptions) {
    super(container, options)
    this.options_ = options
    this.client_ = new MercadoPagoClient({ accessToken: options.accessToken, baseUrl: options.apiBase, fetchImpl: options.fetchImpl })
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = String((input.data as { session_id?: string } | undefined)?.session_id ?? "")
    if (!sessionId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Falta el id de la sesión de pago.")
    const total = MathBN.convert(input.amount as never).toNumber()
    const currency = input.currency_code.toUpperCase()

    try {
      const preference = await this.client_.createPreference(
        buildPreference({
          reference: sessionId,
          title: "Pedido",
          total,
          currency,
          notificationUrl: this.options_.notificationUrl,
          backUrlBase: this.options_.backUrlBase,
        }),
        // Mismo total, misma preferencia: reintentar no crea una segunda.
        `pref-${sessionId}-${Math.round(total * 100)}`
      )
      const data: SessionData = {
        preference_id: preference.id,
        init_point: preference.init_point,
        external_reference: sessionId,
        expected_amount: total,
        expected_currency: currency,
      }
      return { id: preference.id, status: "pending", data: data as Record<string, unknown> }
    } catch (error) {
      throw this.asMedusaError(error)
    }
  }

  private asMedusaError(error: unknown): MedusaError {
    if (error instanceof MpUnavailableError) {
      return new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Mercado Pago no está disponible.", "PAYMENT_PROVIDER_UNAVAILABLE")
    }
    if (error instanceof MpApiError) {
      return new MedusaError(MedusaError.Types.INVALID_DATA, error.message, "PAYMENT_PROVIDER_ERROR")
    }
    return error as MedusaError
  }

  /** Consulta el pago de esta sesión y lo contrasta con lo esperado. */
  private async lookup(data: SessionData | undefined) {
    const reference = data?.external_reference
    if (!reference) return { status: "pending" as const, data: data ?? {} }

    const payment = pickPayment(await this.client_.searchPayments(reference))
    if (!payment) return { status: "pending" as const, data: data ?? {} }

    const evaluated = evaluatePayment(payment, {
      amount: data.expected_amount ?? Number.NaN,
      currency: data.expected_currency ?? "",
      reference,
    })
    const next: SessionData = { ...data, mp_payment_id: String(payment.id) }
    if (evaluated.problem) return { status: "error" as const, data: next }
    switch (mapStatus(payment.status)) {
      case "approved":
        return { status: "captured" as const, data: next }
      case "rejected":
        return { status: "error" as const, data: next }
      case "refunded":
        return { status: "canceled" as const, data: next }
      default:
        return { status: "pending" as const, data: next }
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    try {
      const result = await this.lookup(input.data as SessionData | undefined)
      return { status: result.status, data: result.data as Record<string, unknown> }
    } catch (error) {
      throw this.asMedusaError(error)
    }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    try {
      const result = await this.lookup(input.data as SessionData | undefined)
      return { status: result.status, data: result.data as Record<string, unknown> }
    } catch (error) {
      throw this.asMedusaError(error)
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    // Mercado Pago cobra al aprobar: no hay una captura aparte.
    return { data: input.data }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = input.data as SessionData | undefined
    if (!data?.mp_payment_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "El pago no tiene un id de Mercado Pago para reembolsar.")
    }
    try {
      const amount = MathBN.convert(input.amount as never).toNumber()
      await this.client_.refund(data.mp_payment_id, amount, `refund-${data.mp_payment_id}-${Math.round(amount * 100)}`)
      return { data: input.data }
    } catch (error) {
      throw this.asMedusaError(error)
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    return { data: input.data }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const data = input.data as (SessionData & { session_id?: string }) | undefined
    const sessionId = data?.external_reference ?? data?.session_id
    const total = MathBN.convert(input.amount as never).toNumber()
    // Si el total no cambió, la preferencia sigue valiendo.
    if (data?.preference_id && data.expected_amount !== undefined && Math.round(data.expected_amount * 100) === Math.round(total * 100)) {
      return { data: input.data, status: "pending" }
    }
    const created = await this.initiatePayment({ amount: input.amount, currency_code: input.currency_code, data: { session_id: sessionId } } as InitiatePaymentInput)
    return { data: created.data, status: "pending" }
  }

  /** Las notificaciones entran por /hooks/mercadopago, que valida la firma antes de procesar. */
  async getWebhookActionAndData(_payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    return { action: "not_supported" }
  }
}
