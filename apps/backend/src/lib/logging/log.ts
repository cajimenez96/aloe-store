import { buildEvent } from "./redact"

type Level = "info" | "warn" | "error"
type Logger = { info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void }

/**
 * Registra un evento estructurado de una sola línea JSON (planning.md, HU-49).
 * Lleva el identificador de la solicitud y la fecha, y pasa por la depuración de
 * datos personales (seguridad.md, SEC-70) antes de salir.
 */
export function logEvent(
  logger: Logger,
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
  requestId?: string
): void {
  logger[level](JSON.stringify(buildEvent({ event, requestId, fields })))
}
