import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getTransferCode } from "./secret"
import { scrubSecret } from "./guard"

/**
 * Quita el código de la promoción de transferencia de toda respuesta de la API
 * de tienda (seguridad.md, SEC-31; planning.md, HU-22). Medusa devuelve
 * `promotions.code` y `adjustments.code` dentro del carrito, así que sin esto el
 * código llegaría al navegador apenas se aplicara.
 */
export async function scrubTransferCode(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  let secret: string | null = null
  try {
    secret = await getTransferCode(req.scope)
  } catch {
    // Si no se puede leer la configuración no hay nada que depurar; la ruta responde igual.
  }
  if (!secret) return next()

  const json = res.json.bind(res)
  res.json = ((body: unknown) => json(scrubSecret(body, secret))) as typeof res.json
  next()
}
