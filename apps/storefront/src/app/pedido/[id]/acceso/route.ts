import { NextResponse } from "next/server"
import { getEnv } from "@/lib/env"
import { isOrderId, isOrderToken, orderCookieName, orderCookieOptions } from "@/lib/order/model"

/**
 * Entrada desde el enlace del email (planning.md, HU-23): guarda el token en una
 * cookie HttpOnly y redirige a la página del pedido sin el token en la URL, para
 * que no quede en el historial ni en capturas.
 */
export async function GET(request: Request, ctx: RouteContext<"/pedido/[id]/acceso">) {
  const { id } = await ctx.params
  const token = new URL(request.url).searchParams.get("token") ?? ""

  const target = new URL(`/pedido/${isOrderId(id) ? id : "invalido"}`, request.url)
  const response = NextResponse.redirect(target, 303)
  response.headers.set("Referrer-Policy", "no-referrer")

  if (isOrderId(id) && isOrderToken(token)) {
    response.cookies.set(orderCookieName(id), token, orderCookieOptions(getEnv().backendUrl))
  }
  return response
}
