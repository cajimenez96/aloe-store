import { createHmac } from "node:crypto"
import { buildManifest, signWebhook, verifyWebhookSignature } from "../signature"

const secret = "secreto-de-prueba-local-0123456789"
const now = new Date("2026-10-25T12:00:00Z")
const ts = String(now.getTime()) // Mercado Pago manda milisegundos

function header(dataId: string, requestId: string, tsValue = ts, key = secret) {
  const v1 = createHmac("sha256", key).update(`id:${dataId};request-id:${requestId};ts:${tsValue};`).digest("hex")
  return `ts=${tsValue},v1=${v1}`
}

describe("buildManifest", () => {
  it("usa el formato de Mercado Pago", () => {
    expect(buildManifest({ dataId: "123", requestId: "req-1", ts: "1700000000" })).toBe("id:123;request-id:req-1;ts:1700000000;")
  })
  it("pasa a minúsculas el id si es alfanumérico", () => {
    expect(buildManifest({ dataId: "ABC123", requestId: "r", ts: "1" })).toBe("id:abc123;request-id:r;ts:1;")
  })
})

describe("verifyWebhookSignature (SEC-32, HU-25)", () => {
  const base = { secret, dataId: "123456", requestId: "req-1", now }

  it("acepta una firma válida", () => {
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1") })).toEqual({ ok: true })
  })

  it("rechaza una firma hecha con otro secreto", () => {
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1", ts, "otro-secreto") })).toEqual({
      ok: false,
      reason: "bad_signature",
    })
  })

  it("rechaza si cambió el id del pago, el request id o la marca de tiempo", () => {
    expect(verifyWebhookSignature({ ...base, dataId: "999", signatureHeader: header("123456", "req-1") }).ok).toBe(false)
    expect(verifyWebhookSignature({ ...base, requestId: "otro", signatureHeader: header("123456", "req-1") }).ok).toBe(false)
    const forged = header("123456", "req-1").replace(`ts=${ts}`, `ts=${Number(ts) + 1}`)
    expect(verifyWebhookSignature({ ...base, signatureHeader: forged }).ok).toBe(false)
  })

  it("rechaza una notificación vencida o del futuro (ventana de 5 minutos)", () => {
    const old = String(now.getTime() - 6 * 60_000)
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1", old) })).toEqual({ ok: false, reason: "expired" })
    const future = String(now.getTime() + 6 * 60_000)
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1", future) })).toEqual({ ok: false, reason: "expired" })
    const recent = String(now.getTime() - 4 * 60_000)
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1", recent) }).ok).toBe(true)
  })

  it("acepta la marca de tiempo en segundos", () => {
    const seconds = String(Math.floor(now.getTime() / 1000))
    expect(verifyWebhookSignature({ ...base, signatureHeader: header("123456", "req-1", seconds) }).ok).toBe(true)
  })

  it("rechaza encabezados ausentes o mal formados sin romper", () => {
    for (const bad of [undefined, "", "abc", "ts=,v1=", "ts=1", "v1=zz", `ts=${ts},v1=${"a".repeat(63)}`, `ts=${ts},v1=${"g".repeat(64)}`, `ts=${ts},v1=${"a".repeat(64)}x`]) {
      expect(verifyWebhookSignature({ ...base, signatureHeader: bad as string | undefined }).ok).toBe(false)
    }
  })

  it("sin secreto configurado rechaza todo", () => {
    expect(verifyWebhookSignature({ ...base, secret: "", signatureHeader: header("123456", "req-1", ts, "") }).ok).toBe(false)
  })

  it("signWebhook produce lo que verifyWebhookSignature acepta (lo usa el simulador)", () => {
    const signed = signWebhook({ secret, dataId: "777", requestId: "req-9", now })
    expect(verifyWebhookSignature({ secret, dataId: "777", requestId: "req-9", now, signatureHeader: signed })).toEqual({ ok: true })
  })
})
