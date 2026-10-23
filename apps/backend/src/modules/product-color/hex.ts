/**
 * Devuelve el color en formato #RRGGBB y en mayúsculas, o null si no es válido
 * (planning.md, HU-09). Solo se aceptan seis dígitos hexadecimales.
 */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : null
}
