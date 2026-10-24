import { cookies } from "next/headers"
import { getEnv } from "../env"
import { buildOrderView, isOrderId, isOrderToken, orderCookieName, type OrderView } from "./model"

export type OrderResult =
  | { status: "ok"; order: OrderView }
  | { status: "denied" }
  | { status: "unavailable" }

/**
 * Pedido del cliente invitado, con el token de su cookie (seguridad.md, SEC-24).
 * Todo acceso inválido se muestra igual, sin decir si el pedido existe.
 */
export async function getOrder(orderId: string): Promise<OrderResult> {
  if (!isOrderId(orderId)) return { status: "denied" }
  const token = (await cookies()).get(orderCookieName(orderId))?.value
  if (!token || !isOrderToken(token)) return { status: "denied" }

  const { backendUrl, publishableKey } = getEnv()
  try {
    const response = await fetch(`${backendUrl}/store/order-access/${orderId}`, {
      headers: { "x-publishable-api-key": publishableKey, "x-order-token": token },
      cache: "no-store",
    })
    if (response.status === 404) return { status: "denied" }
    if (!response.ok) return { status: "unavailable" }
    return { status: "ok", order: buildOrderView(await response.json()) }
  } catch {
    return { status: "unavailable" }
  }
}
