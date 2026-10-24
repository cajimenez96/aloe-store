"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getEnv } from "../env"
import { isOrderId, isOrderToken, orderCookieName } from "./model"
import { MAX_PROOF_BYTES, proofErrorMessage } from "./proof"

export type ProofUploadState = { ok: boolean; message: string | null }

/**
 * Sube el comprobante del cliente (planning.md, HU-28). El tipo y el tamaño los
 * valida el backend por el contenido; acá solo se evita mandar un archivo vacío o
 * evidentemente enorme. El token sale de la cookie HttpOnly del pedido.
 */
export async function uploadProof(orderId: string, _previous: ProofUploadState, formData: FormData): Promise<ProofUploadState> {
  if (!isOrderId(orderId)) return { ok: false, message: proofErrorMessage("ORDER_ACCESS_DENIED") }
  const token = (await cookies()).get(orderCookieName(orderId))?.value
  if (!token || !isOrderToken(token)) return { ok: false, message: proofErrorMessage("ORDER_ACCESS_DENIED") }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Elegí el archivo de tu comprobante." }
  }
  if (file.size > MAX_PROOF_BYTES) return { ok: false, message: proofErrorMessage("TRANSFER_PROOF_TOO_LARGE") }

  const body = new FormData()
  body.append("file", file, "comprobante")

  const { backendUrl, publishableKey } = getEnv()
  try {
    const response = await fetch(`${backendUrl}/store/order-access/${orderId}/transfer-proofs`, {
      method: "POST",
      headers: { "x-publishable-api-key": publishableKey, "x-order-token": token },
      body,
      cache: "no-store",
    })
    if (!response.ok) {
      const json = (await response.json().catch(() => ({}))) as { code?: string }
      return { ok: false, message: proofErrorMessage(json.code) }
    }
  } catch {
    return { ok: false, message: proofErrorMessage(undefined) }
  }

  revalidatePath(`/pedido/${orderId}`)
  return { ok: true, message: "Recibimos tu comprobante. Lo vamos a revisar." }
}
