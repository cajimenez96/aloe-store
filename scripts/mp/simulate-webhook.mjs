#!/usr/bin/env node
/**
 * Envía a mano al backend local una notificación de Mercado Pago firmada con el secreto de
 * prueba (arquitectura.md, sección 10.4; planning.md, HU-25). Cubre los casos de seguridad.md,
 * SEC-32: firma válida, firma inválida, notificación vencida y repetida.
 *
 *   MP_WEBHOOK_SECRET=... node scripts/mp/simulate-webhook.mjs --payment 1000 --scenario valid
 *
 * Opciones: --url (por defecto http://localhost:9000/hooks/mercadopago), --payment <id>,
 * --scenario valid | invalid-signature | expired | replay, --request-id <id>.
 * La firma se arma acá, con su propia implementación del algoritmo de Mercado Pago, a
 * propósito: así las pruebas no coinciden por compartir el mismo código.
 */
import { createHmac } from "node:crypto"

const args = Object.fromEntries(process.argv.slice(2).flatMap((arg, i, all) => (arg.startsWith("--") ? [[arg.slice(2), all[i + 1]]] : [])))
const url = args.url ?? "http://localhost:9000/hooks/mercadopago"
const secret = process.env.MP_WEBHOOK_SECRET
const scenario = args.scenario ?? "valid"
const paymentId = args.payment
if (!secret || !paymentId) {
  console.error("Falta MP_WEBHOOK_SECRET o --payment <id>.")
  process.exit(2)
}

function signed(id, requestId, ts, key = secret) {
  const v1 = createHmac("sha256", key).update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex")
  return `ts=${ts},v1=${v1}`
}

async function send(label, { key = secret, ts = Date.now(), requestId = args["request-id"] ?? `sim-${Date.now()}` } = {}) {
  const response = await fetch(`${url}?data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId, "x-signature": signed(paymentId, requestId, ts, key) },
    body: JSON.stringify({ action: "payment.updated", type: "payment", data: { id: String(paymentId) } }),
  })
  console.log(`${label.padEnd(24)} -> ${response.status} ${await response.text()}`)
}

if (scenario === "valid") await send("firma válida")
else if (scenario === "invalid-signature") await send("firma inválida", { key: "otro-secreto" })
else if (scenario === "expired") await send("notificación vencida", { ts: Date.now() - 10 * 60_000 })
else if (scenario === "replay") {
  const requestId = `sim-replay-${Date.now()}`
  await send("primera vez", { requestId })
  await send("repetida", { requestId })
} else {
  console.error(`Escenario desconocido: ${scenario}`)
  process.exit(2)
}
