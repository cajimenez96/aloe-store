import { expect, test } from "@playwright/test"
import { PNG, createTransferOrder, proofsOf, uploadProof } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

// Revisión de seguridad (HU-45): subidas simultáneas no pueden saltear "un solo
// comprobante en revisión" ni el tope de subidas por hora.
test("seis subidas simultáneas del mismo pedido dejan un solo comprobante en revisión", async () => {
  const seed = loadSeed()
  const order = await createTransferOrder(seed, `paralelo-${Date.now()}@ejemplo.com`)
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => uploadProof(order.orderId, order.token, PNG(`paralelo-${i}`))))

  const statuses = results.map((r) => r.status).sort()
  expect(statuses.filter((s) => s === 201)).toHaveLength(1)
  expect(results.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.json.code === "TRANSFER_PROOF_PENDING")).toBe(true)
  expect((await proofsOf(order.orderId)).filter((p) => p.status === "pending_review")).toHaveLength(1)
})
