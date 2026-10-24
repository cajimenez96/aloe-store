/**
 * Depuración de datos personales para los logs (seguridad.md, SEC-70): nunca se
 * registran CBU, documento, teléfono, dirección, emails completos, tokens ni el
 * contenido de comprobantes.
 */

const FORBIDDEN_KEYS = /(cbu|cvu|document|dni|phone|telefono|address|direccion|street|city|province|postal|email|token|password|secret|authorization|cookie|file|content|body|name$|^name)/i

export function maskEmail(value: unknown): string {
  if (typeof value !== "string") return "***"
  const [local, domain] = value.split("@")
  return local && domain ? `${local[0]}***@${domain}` : "***"
}

/** Oculta en un texto libre lo que parece un dato personal o un secreto. */
export function redactText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/([?&]token=)[A-Za-z0-9_-]+/gi, "$1[token]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[token]")
    .replace(/\b\d{22}\b/g, "[cuenta]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[numero]")
}

type Scalar = string | number | boolean

export function buildEvent(input: {
  event: string
  requestId: string | undefined
  at?: Date
  fields: Record<string, unknown>
}): Record<string, Scalar | null> {
  const out: Record<string, Scalar | null> = {
    event: input.event,
    request_id: input.requestId ?? null,
    at: (input.at ?? new Date()).toISOString(),
  }
  for (const [key, value] of Object.entries(input.fields)) {
    if (FORBIDDEN_KEYS.test(key)) continue
    if (typeof value === "string") out[key] = redactText(value)
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value
  }
  return out
}
