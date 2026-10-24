import { createHmac, timingSafeEqual } from "node:crypto"

const TOLERANCE_MS = 5 * 60_000

/** Texto firmado por Mercado Pago: `id:[data.id];request-id:[x-request-id];ts:[ts];`. */
export function buildManifest(input: { dataId: string; requestId: string; ts: string }): string {
  // Si el id es alfanumérico, Mercado Pago lo firma en minúsculas.
  const id = /^[A-Za-z0-9]+$/.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId
  return `id:${id};request-id:${input.requestId};ts:${input.ts};`
}

const hmac = (secret: string, manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex")

export type SignatureResult = { ok: true } | { ok: false; reason: "bad_signature" | "expired" }

/**
 * Valida la firma de una notificación de Mercado Pago con HMAC SHA256 y compara en
 * tiempo constante (seguridad.md, SEC-32; planning.md, HU-25). Rechaza las
 * notificaciones cuya marca de tiempo está fuera de una ventana de 5 minutos.
 */
export function verifyWebhookSignature(input: {
  secret: string
  signatureHeader: string | undefined
  dataId: string
  requestId: string
  now?: Date
}): SignatureResult {
  const bad: SignatureResult = { ok: false, reason: "bad_signature" }
  if (!input.secret || !input.signatureHeader) return bad

  const parts = Object.fromEntries(
    input.signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=")
      return [key, rest.join("=")]
    })
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !/^\d{1,16}$/.test(ts) || !v1 || !/^[a-f0-9]{64}$/.test(v1)) return bad

  const expected = Buffer.from(hmac(input.secret, buildManifest({ dataId: input.dataId, requestId: input.requestId, ts })), "hex")
  const received = Buffer.from(v1, "hex")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return bad

  // La marca de tiempo puede venir en segundos o en milisegundos.
  const stamp = Number(ts)
  const ms = stamp < 1e12 ? stamp * 1000 : stamp
  if (Math.abs((input.now ?? new Date()).getTime() - ms) > TOLERANCE_MS) return { ok: false, reason: "expired" }
  return { ok: true }
}

/** Genera el encabezado `x-signature` con el secreto de prueba local; lo usa el simulador de webhooks. */
export function signWebhook(input: { secret: string; dataId: string; requestId: string; now?: Date; ts?: string }): string {
  const ts = input.ts ?? String((input.now ?? new Date()).getTime())
  return `ts=${ts},v1=${hmac(input.secret, buildManifest({ dataId: input.dataId, requestId: input.requestId, ts }))}`
}
