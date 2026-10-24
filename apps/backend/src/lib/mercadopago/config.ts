export type MpConfig = {
  enabled: boolean
  accessToken: string
  /** API de Mercado Pago o del simulador local. */
  apiBase: string
  webhookSecret: string
  notificationUrl?: string
  backUrlBase?: string
}

/**
 * Configuración de Mercado Pago desde variables de entorno. `MP_NOTIFICATION_URL` y
 * `MP_BACK_URL_BASE` son opcionales: sin URL pública la preferencia se crea sin ellas
 * (arquitectura.md, sección 10.4). `MP_API_BASE` apunta al simulador en las pruebas.
 */
export function readMpConfig(env: Record<string, string | undefined>): MpConfig {
  return {
    enabled: Boolean(env.MP_ACCESS_TOKEN),
    accessToken: env.MP_ACCESS_TOKEN ?? "",
    apiBase: env.MP_API_BASE || "https://api.mercadopago.com",
    webhookSecret: env.MP_WEBHOOK_SECRET ?? "",
    notificationUrl: env.MP_NOTIFICATION_URL || undefined,
    backUrlBase: env.MP_BACK_URL_BASE || undefined,
  }
}

export const MP_PROVIDER_ID = "pp_mercadopago_mercadopago"
