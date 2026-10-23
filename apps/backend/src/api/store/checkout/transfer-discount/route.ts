import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { pickTransferPercent } from "../../../../lib/transfer-discount/percent"

/**
 * Porcentaje de descuento por transferencia para mostrar en la tienda
 * (planning.md, HU-15). Devuelve solo el porcentaje: el código de la promoción
 * es interno y nunca sale por la API de tienda (seguridad.md, SEC-31).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "metadata"],
  })
  const code = (stores[0]?.metadata as Record<string, unknown> | null | undefined)
    ?.transfer_promotion_code

  if (typeof code !== "string" || !code) {
    res.json({ percent: 0 })
    return
  }

  const { data: promotions } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "status",
      "application_method.type",
      "application_method.target_type",
      "application_method.value",
      "campaign.starts_at",
      "campaign.ends_at",
    ],
    filters: { code },
  })

  res.json({ percent: pickTransferPercent(promotions[0]) })
}
