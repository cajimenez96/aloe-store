const MERCADO_PAGO = ["https://*.mercadopago.com", "https://*.mercadopago.com.ar"]

type Input = { backendUrl: string; imagesHost: string; isDev: boolean }

/** Origen de una URL, o null si no es una http(s) válida (así no entra texto arbitrario a la política). */
function originOf(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null
  } catch {
    return null
  }
}

/**
 * Política de seguridad de contenido del storefront (seguridad.md, SEC-60; planning.md,
 * HU-44): el propio origen, el backend, el host de imágenes y Mercado Pago. Los
 * scripts y estilos en línea se permiten porque la alternativa con nonce obliga a
 * renderizar todo en cada pedido y desactiva el prerenderizado parcial; el resto de
 * las directivas (conexiones, objetos, formularios, iframes) queda estricto. HSTS se
 * agrega al desplegar con HTTPS.
 */
export function buildCsp({ backendUrl, imagesHost, isDev }: Input): string {
  const backend = originOf(backendUrl)
  const backendIsHttps = backend?.startsWith("https://") ?? false
  const images = /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(imagesHost)
    ? `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(imagesHost) ? "http" : "https"}://${imagesHost}`
    : null

  const directives: string[] = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://sdk.mercadopago.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${images ? ` ${images}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${backend ? ` ${backend}` : ""} https://api.mercadopago.com`,
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${MERCADO_PAGO.join(" ")}`,
    "frame-ancestors 'none'",
  ]
  if (backendIsHttps) directives.push("upgrade-insecure-requests")

  return directives.join("; ")
}
