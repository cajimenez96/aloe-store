import Medusa from "@medusajs/js-sdk"
import { getEnv } from "./env"

let sdk: Medusa | undefined

/**
 * Cliente de la API de tienda de Medusa. Se crea al usarlo y no al importar,
 * para que un build sin clave publicable no falle (la clave se exige acá).
 * El storefront nunca envía precios, solo variantes y cantidades (SEC-30).
 */
export function getSdk(): Medusa {
  if (!sdk) {
    const { backendUrl, publishableKey } = getEnv()
    if (!publishableKey) {
      throw new Error(
        "Falta NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY. Ejecutá `npm run setup:store` y copiá la clave que imprime."
      )
    }
    sdk = new Medusa({ baseUrl: backendUrl, publishableKey })
  }
  return sdk
}
