/**
 * El build de producción de Medusa marca la cookie de sesión del panel como
 * `Secure`, y por http el navegador no la guarda: el panel no deja iniciar sesión.
 * Para correr ese build en local (pruebas de punta a punta, planning.md HU-46) se
 * permite quitar `Secure` con `INSECURE_SESSION_COOKIE=true`. Solo vale si el
 * backend es un host local por http: en un despliegue se niega a arrancar.
 */
export function sessionCookieOptions(env: Record<string, string | undefined>): { secure: false } | undefined {
  if (env.INSECURE_SESSION_COOKIE !== "true") return undefined

  let local = false
  try {
    const url = new URL(env.MEDUSA_BACKEND_URL ?? "")
    local = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  } catch {
    local = false
  }
  if (!local) {
    throw new Error(
      "INSECURE_SESSION_COOKIE=true solo se admite con MEDUSA_BACKEND_URL=http://localhost:<puerto>. Quitá la variable en cualquier despliegue."
    )
  }
  return { secure: false }
}
