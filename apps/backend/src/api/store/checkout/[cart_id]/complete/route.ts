import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { sendEmail } from "../../../../../lib/notifications/send-email"
import { fail } from "../../../../../lib/order-access/http"
import { clientIp, trustedHopsFromEnv } from "../../../../../lib/order-access/ip"
import { hashIp, normalizeEmail, pendingLimitReached } from "../../../../../lib/order-access/limits"
import { addTokenHash } from "../../../../../lib/order-access/hashes"
import { generateToken, hashToken } from "../../../../../lib/order-access/token"
import { mergeSettings } from "../../../../../lib/store-settings/validation"

const money = (value: unknown) => MathBN.convert(value as never).toNumber()
const formatMoney = (amount: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(amount)

/**
 * Confirma el pedido por transferencia (planning.md, HU-23 y HU-27). Es el único
 * camino para completar un carrito: genera el token de acceso (se devuelve una
 * sola vez y en la base queda su hash), aplica el límite de pedidos pendientes
 * (SEC-40) y envía el email con los datos bancarios.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.cart_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "completed_at",
      "metadata",
      "items.id",
      "shipping_methods.id",
      "shipping_address.first_name",
      "shipping_address.last_name",
    ],
    filters: { id: cartId },
  })
  if (!cart) return fail(res, 404, "CART_NOT_FOUND", "No encontramos tu carrito.")
  if (cart.completed_at) {
    return fail(res, 409, "CART_ALREADY_COMPLETED", "Este pedido ya fue confirmado. Revisá tu email.")
  }

  const method = (cart.metadata as Record<string, unknown> | null)?.payment_method
  if (method !== "transfer" && method !== "card") {
    return fail(res, 422, "PAYMENT_METHOD_REQUIRED", "Elegí cómo querés pagar para confirmar el pedido.")
  }
  if (method === "card") {
    return fail(res, 503, "PAYMENT_PROVIDER_UNAVAILABLE", "El pago con tarjeta todavía no está disponible. Pagá por transferencia.")
  }
  if (!cart.email || (cart.shipping_methods ?? []).length === 0 || !cart.shipping_address?.first_name) {
    return fail(res, 422, "CHECKOUT_INCOMPLETE", "Completá tus datos y la forma de entrega para confirmar.")
  }
  if ((cart.items ?? []).length === 0) {
    return fail(res, 422, "CHECKOUT_INCOMPLETE", "Tu carrito está vacío.")
  }

  const {
    data: [store],
  } = await query.graph({ entity: "store", fields: ["id", "name", "metadata"] })
  const settings = mergeSettings(store?.metadata)
  if (!settings.bank_account) {
    return fail(res, 503, "PAYMENT_PROVIDER_UNAVAILABLE", "La transferencia no está disponible por ahora.")
  }

  const ipHash = hashIp(
    clientIp({
      remoteAddress: req.socket.remoteAddress,
      forwardedFor: req.headers["x-forwarded-for"] as string | undefined,
      trustedHops: trustedHopsFromEnv(process.env.TRUSTED_PROXY_HOPS),
    })
  )
  // El control del límite y la creación del pedido van juntos bajo un bloqueo por
  // email y por IP: sin él, pedidos en paralelo pasan todos el control (SEC-40).
  // El mismo bloqueo evita que dos llamadas sobre un mismo carrito generen dos tokens.
  const keys = [`order-limit:email:${normalizeEmail(cart.email)}`, ...(ipHash ? [`order-limit:ip:${ipHash}`] : [])].sort()
  const locking = req.scope.resolve(Modules.LOCKING)

  type Outcome =
    | { ok: true; body: { order_id: string; display_id: number; token: string } }
    | { ok: false; status: number; code: string; message: string }

  const outcome: Outcome = await locking.execute(
    keys,
    async (): Promise<Outcome> => {
      const {
        data: [fresh],
      } = await query.graph({ entity: "cart", fields: ["id", "completed_at"], filters: { id: cartId } })
      if (fresh?.completed_at) {
        return { ok: false, status: 409, code: "CART_ALREADY_COMPLETED", message: "Este pedido ya fue confirmado. Revisá tu email." }
      }

      const since = new Date(Date.now() - 24 * 3_600_000)
      const { data: recent } = await query.graph({
        entity: "order",
        fields: ["id", "email", "status", "created_at", "metadata"],
        filters: { status: "pending", created_at: { $gte: since } },
      })
      const limit = pendingLimitReached({
        email: cart.email as string,
        ipHash,
        orders: recent.map((order) => ({
          email: order.email,
          status: order.status,
          createdAt: new Date(order.created_at as string),
          ipHash: (order.metadata as Record<string, unknown> | null)?.client_ip_hash as string | undefined,
        })),
      })
      if (limit) {
        return {
          ok: false,
          status: 429,
          code: "PENDING_ORDERS_LIMIT",
          message: "Ya tenés pedidos pendientes de pago. Completá o esperá el vencimiento de uno anterior.",
        }
      }

      const { result } = await completeCartWorkflow(req.scope).run({ input: { id: cartId } })
      const orderId = (result as { id: string }).id

      const {
        data: [order],
      } = await query.graph({
        entity: "order",
        fields: ["id", "display_id", "total", "metadata", "created_at"],
        filters: { id: orderId },
      })

      const token = generateToken()
      const dueAt = new Date(Date.now() + settings.transfer_reservation_hours * 3_600_000)
      const reference = `PED-${order.display_id}`
      await req.scope.resolve(Modules.ORDER).updateOrders(orderId, {
        metadata: {
          ...addTokenHash((order.metadata ?? {}) as Record<string, unknown>, hashToken(token)),
          payment_method: "transfer",
          transfer_reference: reference,
          transfer_due_at: dueAt.toISOString(),
          client_ip_hash: ipHash,
          customer_document: (cart.metadata as Record<string, unknown> | null)?.customer_document ?? null,
        },
      })

      const storefront = (process.env.STOREFRONT_URL ?? "http://localhost:3000").replace(/\/+$/, "")
      void sendEmail(req.scope, {
        to: cart.email as string,
        template: "transfer-order",
        data: {
          name: cart.shipping_address?.first_name ?? "",
          orderNumber: String(order.display_id),
          total: formatMoney(money(order.total)),
          holder: settings.bank_account!.holder,
          cbu: settings.bank_account!.cbu,
          alias: settings.bank_account!.alias,
          bank: settings.bank_account!.bank,
          reference,
          dueDate: dueAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }),
          link: `${storefront}/pedido/${orderId}/acceso?token=${token}`,
        },
      })

      return { ok: true, body: { order_id: orderId, display_id: Number(order.display_id), token } }
    },
    { timeout: 15 }
  )

  if (!outcome.ok) return fail(res, outcome.status, outcome.code, outcome.message)
  res.json(outcome.body)
}
