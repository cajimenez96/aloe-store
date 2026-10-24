import { expect, test } from "@playwright/test"
import { call, createTransferOrder, proofsOf, runExpiryJob, session, uploadProof } from "../helpers/api"
import { loadSeed } from "../helpers/seed"

test("vencimiento: el job cancela solo el pedido vencido sin comprobante en revisión y libera el stock", async () => {
  const seed = loadSeed()
  const { admin } = await session()
  const past = new Date(Date.now() - 3_600_000).toISOString()
  const expire = async (orderId: string) => {
    const current = (await call("GET", `/admin/orders/${orderId}?fields=id,metadata`, admin)).json.order
    await call("POST", `/admin/orders/${orderId}`, admin, { metadata: { ...current.metadata, transfer_due_at: past } })
  }
  const status = async (orderId: string) => (await call("GET", `/admin/orders/${orderId}?fields=id,status,metadata`, admin)).json.order

  const withoutProof = await createTransferOrder(seed, `vence-${Date.now()}@ejemplo.com`)
  const inReview = await createTransferOrder(seed, `revision-${Date.now()}@ejemplo.com`)
  const notYet = await createTransferOrder(seed, `vigente-${Date.now()}@ejemplo.com`)
  expect((await uploadProof(inReview.orderId, inReview.token)).status).toBe(201)
  expect((await proofsOf(inReview.orderId))[0].status).toBe("pending_review")

  await expire(withoutProof.orderId)
  await expire(inReview.orderId)

  // Reservas de stock de un pedido, por el id de sus líneas (así no dependen de otros escenarios).
  const reservationsOf = async (orderId: string) => {
    const items = (await call("GET", `/admin/orders/${orderId}?fields=id,items.id`, admin)).json.order.items as { id: string }[]
    const query = items.map((item) => `line_item_id[]=${item.id}`).join("&")
    return (await call("GET", `/admin/reservations?${query}`, admin)).json.count as number
  }
  expect(await reservationsOf(withoutProof.orderId)).toBe(1)
  expect(await reservationsOf(inReview.orderId)).toBe(1)
  runExpiryJob()

  expect((await status(withoutProof.orderId)).status).toBe("canceled")
  expect((await status(withoutProof.orderId)).metadata.cancel_reason).toBe("expired")
  expect((await status(inReview.orderId)).status).toBe("pending")
  expect((await status(notYet.orderId)).status).toBe("pending")
  // La cancelación libera el stock del vencido y deja el del que está en revisión.
  expect(await reservationsOf(withoutProof.orderId)).toBe(0)
  expect(await reservationsOf(inReview.orderId)).toBe(1)
  expect(await reservationsOf(notYet.orderId)).toBe(1)
})
