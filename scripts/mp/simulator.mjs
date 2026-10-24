#!/usr/bin/env node
/**
 * Simulador local de Mercado Pago (arquitectura.md, sección 10.4): imita lo mínimo de su
 * API (preferencias, pagos, búsqueda y reembolsos) y ofrece una página de pago de prueba
 * con "Aprobar" y "Rechazar". Sirve para desarrollar y probar el flujo de tarjeta sin
 * cuenta, sin internet y sin URL pública.
 *
 *   MP_API_BASE=http://localhost:9400 MP_ACCESS_TOKEN=TEST-simulador npm run mp:simulator
 *
 * No es Mercado Pago: la verificación real en sandbox es la historia SP-02.
 */
import http from "node:http"

const PORT = Number(process.env.SIM_PORT ?? 9400)
const PUBLIC = process.env.SIM_PUBLIC_URL ?? `http://localhost:${PORT}`
const TOKEN = process.env.SIM_TOKEN ?? process.env.MP_ACCESS_TOKEN ?? "TEST-simulador"

const preferences = new Map()
const payments = new Map()
let nextPayment = 1000
let nextPreference = 1

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ""
    req.on("data", (chunk) => (raw += chunk))
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })

function createPayment({ reference, status, amount, currency }) {
  const payment = {
    id: nextPayment++,
    status,
    transaction_amount: amount,
    currency_id: currency,
    external_reference: reference,
    date_created: new Date().toISOString(),
  }
  payments.set(String(payment.id), payment)
  return payment
}

const page = (id, pref) => `<!doctype html><meta charset="utf-8"><title>Mercado Pago (simulador)</title>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto">
<h1>Mercado Pago · simulador</h1>
<p>Pedido <code>${pref.external_reference}</code></p>
<p><strong>${pref.items[0].currency_id} ${pref.items[0].unit_price}</strong></p>
<form method="post" action="/pay/${id}/approve"><button>Aprobar el pago</button></form><br>
<form method="post" action="/pay/${id}/reject"><button>Rechazar el pago</button></form>
</body>`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", PUBLIC)
  const path = url.pathname

  // Página de pago de prueba (sin autenticación, como la real).
  const pay = /^\/pay\/(pref_\d+)(?:\/(approve|reject))?$/.exec(path)
  if (pay) {
    const pref = preferences.get(pay[1])
    if (!pref) return json(res, 404, { message: "preferencia inexistente" })
    if (req.method === "GET" && !pay[2]) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      return res.end(page(pay[1], pref))
    }
    if (req.method === "POST" && pay[2]) {
      const item = pref.items[0]
      createPayment({
        reference: pref.external_reference,
        status: pay[2] === "approve" ? "approved" : "rejected",
        amount: item.unit_price,
        currency: item.currency_id,
      })
      const back = pref.back_urls?.[pay[2] === "approve" ? "success" : "failure"]
      if (back) {
        res.writeHead(303, { location: back })
        return res.end()
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      return res.end("<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif'><h1>Listo</h1><p>Ya podés volver a la tienda y tocar «Verificar mi pago».</p></body>")
    }
  }

  if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { message: "invalid access token" })

  if (req.method === "POST" && path === "/checkout/preferences") {
    const pref = await readBody(req)
    const id = `pref_${nextPreference++}`
    preferences.set(id, pref)
    return json(res, 201, { id, init_point: `${PUBLIC}/pay/${id}`, sandbox_init_point: `${PUBLIC}/pay/${id}` })
  }
  if (req.method === "GET" && path === "/v1/payments/search") {
    const reference = url.searchParams.get("external_reference")
    const results = [...payments.values()].filter((payment) => payment.external_reference === reference)
    return json(res, 200, { results })
  }
  const one = /^\/v1\/payments\/(\w+)$/.exec(path)
  if (req.method === "GET" && one) {
    const payment = payments.get(one[1])
    return payment ? json(res, 200, payment) : json(res, 404, { message: "payment not found" })
  }
  const refund = /^\/v1\/payments\/(\w+)\/refunds$/.exec(path)
  if (req.method === "POST" && refund) {
    const payment = payments.get(refund[1])
    if (!payment) return json(res, 404, { message: "payment not found" })
    const body = await readBody(req)
    payment.status = body.amount && body.amount < payment.transaction_amount ? "approved" : "refunded"
    payment.refunds = [...(payment.refunds ?? []), { amount: body.amount ?? payment.transaction_amount }]
    return json(res, 201, { id: Date.now() })
  }

  // Control para las pruebas: crea un pago cualquiera (por ejemplo, con otro monto).
  if (req.method === "POST" && path === "/__sim/payments") {
    const body = await readBody(req)
    return json(res, 201, createPayment({ reference: body.external_reference, status: body.status ?? "approved", amount: body.amount, currency: body.currency ?? "ARS" }))
  }
  if (req.method === "GET" && path === "/__sim/state") {
    return json(res, 200, { preferences: [...preferences.entries()], payments: [...payments.values()] })
  }

  return json(res, 404, { message: "not found" })
})

server.listen(PORT, "127.0.0.1", () => console.log(`Simulador de Mercado Pago en ${PUBLIC} (token: ${TOKEN})`))
