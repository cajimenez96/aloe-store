import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { cartFetch, readCartId } from "@/lib/cart/api"
import { CART_COOKIE } from "@/lib/cart/model"
import { getEnv } from "@/lib/env"
import { isOrderToken, orderCookieName, orderCookieOptions } from "@/lib/order/model"
import { returnTarget, type PaymentStatusReply } from "@/lib/payment/return"

/**
 * Verificación del pago con tarjeta (planning.md, HU-24; seguridad.md, SEC-33). Es a donde
 * vuelve el cliente desde Mercado Pago o al que llega con «verificá tu pago». No lee
 * nada de la URL: le pregunta al backend, que consulta a Mercado Pago. Si el pago está
 * aprobado, guarda el acceso al pedido y lleva a su página.
 */
export async function GET(request: Request) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303)

  const cartId = await readCartId()
  if (!cartId) return go("/carrito")

  const result = await cartFetch<PaymentStatusReply & { token?: string }>(`/store/checkout/${cartId}/payment-status`)
  if (!result.ok) return go(result.error.code === "STORE_UNAVAILABLE" || result.error.code === "PAYMENT_PROVIDER_UNAVAILABLE" ? "/pago/pendiente" : "/checkout")

  const target = returnTarget(result.body)
  if (target.kind === "page") return go(target.path)

  const token = result.body.token ?? ""
  if (!isOrderToken(token)) return go("/pago/pendiente")

  const store = await cookies()
  store.set(orderCookieName(target.orderId), token, orderCookieOptions(getEnv().backendUrl))
  store.delete(CART_COOKIE)
  return go(`/pedido/${target.orderId}`)
}
