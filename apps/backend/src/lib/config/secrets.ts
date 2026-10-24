const WEAK = new Set(["supersecret", "secret", "changeme", "change-me", "password", "test", "default"])
const MIN_LENGTH = 32

function isWeak(value: string | undefined): boolean {
  if (!value || value.length < MIN_LENGTH) return true
  if (WEAK.has(value.toLowerCase())) return true
  return new Set(value).size < 8 // casi todo el mismo carácter
}

/**
 * En producción el backend se niega a arrancar con secretos faltantes, de ejemplo o
 * cortos (seguridad.md, SEC-10): el starter de Medusa trae `supersecret` en su
 * plantilla de entorno. En desarrollo no bloquea. El mensaje nunca repite el valor.
 */
export function assertStrongSecrets(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV !== "production") return
  for (const name of ["JWT_SECRET", "COOKIE_SECRET"]) {
    if (isWeak(env[name])) {
      throw new Error(
        `${name} falta o es débil: en producción debe ser un valor aleatorio propio de al menos ${MIN_LENGTH} caracteres (por ejemplo \`openssl rand -hex 32\`).`
      )
    }
  }
}
