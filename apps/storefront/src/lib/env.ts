/**
 * Variables públicas del storefront (seguridad.md, SEC-10): solo estas tres
 * pueden llevar el prefijo NEXT_PUBLIC_. Cualquier otra variable pública es un
 * error.
 */
export type PublicEnv = {
  backendUrl: string
  publishableKey: string
  imagesHost: string
}

type Source = Record<string, string | undefined>

const HOST_PATTERN = /^[A-Za-z0-9.-]+(:\d{1,5})?$/

/** Valida y normaliza las variables. Los mensajes nunca repiten los valores. */
export function parsePublicEnv(source: Source): PublicEnv {
  const errors: string[] = []

  const rawUrl = source.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? ""
  let backendUrl = ""
  try {
    const url = new URL(rawUrl)
    if (url.protocol === "http:" || url.protocol === "https:") {
      backendUrl = rawUrl.replace(/\/+$/, "")
    }
  } catch {
    // Se informa abajo.
  }
  if (!backendUrl) {
    errors.push(
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL debe ser una URL http o https, por ejemplo http://localhost:9000."
    )
  }

  const publishableKey = source.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ""
  if (publishableKey && !publishableKey.startsWith("pk_")) {
    errors.push(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY debe ser la clave publicable (empieza con pk_), no una clave secreta."
    )
  }

  const imagesHost = source.NEXT_PUBLIC_IMAGES_HOST ?? ""
  if (imagesHost && !HOST_PATTERN.test(imagesHost)) {
    errors.push(
      "NEXT_PUBLIC_IMAGES_HOST debe ser un host o host:puerto, sin esquema ni ruta, por ejemplo localhost:9000."
    )
  }

  if (errors.length) {
    throw new Error(`Configuración de entorno inválida:\n- ${errors.join("\n- ")}`)
  }

  return { backendUrl, publishableKey, imagesHost }
}

let cached: PublicEnv | undefined

/**
 * Next.js reemplaza las variables NEXT_PUBLIC_ solo cuando se leen con el nombre
 * completo, por eso se arman una por una acá.
 */
export function getEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL,
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
    NEXT_PUBLIC_IMAGES_HOST: process.env.NEXT_PUBLIC_IMAGES_HOST,
  })
  return cached
}
