import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import {
  mergeSettings,
  validateSettingsPatch,
} from "../../../lib/store-settings/validation"
import { resetTransferCodeCache } from "../../../lib/transfer-discount/secret"

async function readStore(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "store",
    fields: ["id", "metadata"],
  })
  return data[0]
}

/** Lee la configuración del comercio (arquitectura.md, secciones 6 y 13.3). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const store = await readStore(req)
  res.json({ settings: mergeSettings(store?.metadata) })
}

/** Actualiza las claves de la configuración en `store.metadata`. */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const result = validateSettingsPatch(req.body)
  if (!result.ok) {
    res.status(422).json({
      type: "invalid_data",
      code: "SETTING_INVALID",
      message: "Hay valores de configuración inválidos. Corregí los campos marcados.",
      details: { fields: result.errors },
    })
    return
  }

  const store = await readStore(req)
  if (!store) {
    res.status(404).json({
      type: "not_found",
      message: "No hay una tienda configurada. Ejecutá la configuración base.",
    })
    return
  }

  const metadata = { ...(store.metadata ?? {}), ...result.value }
  await updateStoresWorkflow(req.scope).run({
    input: { selector: { id: store.id }, update: { metadata } },
  })

  // Un código nuevo debe regir ya en la depuración y en el hook, no 10 segundos después.
  resetTransferCodeCache()
  res.json({ settings: mergeSettings(metadata) })
}
