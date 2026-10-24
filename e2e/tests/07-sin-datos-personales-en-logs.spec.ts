import { expect, test } from "@playwright/test"
import { createTransferOrder, proofsOf, session, uploadProof, call } from "../helpers/api"
import { SENTINELS } from "../helpers/env"
import { loadSeed } from "../helpers/seed"

// Este escenario genera actividad con datos personales reconocibles. Que no aparezcan
// en el log del servidor lo verifica scripts/e2e/run.mjs al terminar (SEC-70, HU-49).
test("actividad con datos personales para la verificación de los logs", async () => {
  const seed = loadSeed()
  const { admin } = await session()
  const order = await createTransferOrder(seed, `zulema.quintana.${Date.now()}@correo.com`, { sentinels: true })
  expect((await uploadProof(order.orderId, order.token, Buffer.from(SENTINELS.proofMarker))).status).toBe(415)
  const withMarker = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(SENTINELS.proofMarker)])
  expect((await uploadProof(order.orderId, order.token, withMarker)).status).toBe(201)
  const [proof] = await proofsOf(order.orderId)
  expect((await call("POST", `/admin/transfer-proofs/${proof.id}/reject`, admin, { reason: "No se alcanza a leer el comprobante." })).status).toBe(200)
})
