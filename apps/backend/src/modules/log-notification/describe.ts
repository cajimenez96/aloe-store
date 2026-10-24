import { maskEmail } from "../../lib/logging/redact"

type Notification = {
  to?: string
  channel?: string
  template?: string
  data?: Record<string, unknown> | null
}

/**
 * Qué se registra de un email en local (seguridad.md, SEC-70). El proveedor local de
 * Medusa vuelca el cuerpo completo: CBU, nombre y el enlace con token. Acá solo se
 * deja la plantilla, el canal, el destinatario enmascarado y el asunto. El texto se
 * agrega únicamente con `LOG_EMAIL_BODIES=true`, para probar el enlace en desarrollo.
 */
export function describeNotification(notification: Notification, includeBody: boolean) {
  const data = notification.data ?? {}
  const fields: Record<string, string> = {
    template: String(notification.template ?? ""),
    channel: String(notification.channel ?? ""),
    to_masked: maskEmail(notification.to),
    subject: typeof data.subject === "string" ? data.subject : "",
  }
  if (includeBody && typeof data.text === "string") fields.text = data.text
  return fields
}
