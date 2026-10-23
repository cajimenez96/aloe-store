import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const TTL_MS = 10_000
let cached: { value: string | null; at: number } | null = null

/**
 * Código interno de la promoción de transferencia, guardado en la configuración
 * del comercio (arquitectura.md, sección 6). Solo lo lee el backend. Se guarda
 * unos segundos en memoria porque lo consulta cada respuesta de la tienda.
 */
export async function getTransferCode(container: MedusaContainer): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
  const code = (store?.metadata as Record<string, unknown> | null | undefined)?.transfer_promotion_code
  const value = typeof code === "string" && code ? code : null

  cached = { value, at: Date.now() }
  return value
}

/** Solo para pruebas y para cuando el admin cambia el código. */
export function resetTransferCodeCache() {
  cached = null
}
