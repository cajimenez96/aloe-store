import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils"
import { orderAccessDenied } from "../../../../lib/order-access/http"
import { tokenMatches } from "../../../../lib/order-access/hashes"
import { isTokenExpired } from "../../../../lib/order-access/token"
import { TRANSFER_PROOF_MODULE } from "../../../../modules/transfer-proof"
import type TransferProofModuleService from "../../../../modules/transfer-proof/service"
import { mergeSettings, type BankAccount } from "../../../../lib/store-settings/validation"

const num = (value: unknown) => MathBN.convert((value ?? 0) as never).toNumber()

/**
 * Detalle del pedido para el cliente invitado (arquitectura.md, sección 13;
 * planning.md, HU-23). Se entra con el token del enlace del email en el header
 * `x-order-token`. Cualquier fallo responde igual (SEC-24).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const header = req.headers["x-order-token"]
  const token = typeof header === "string" ? header : ""
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "status",
      "currency_code",
      "created_at",
      "updated_at",
      "email",
      "metadata",
      "subtotal",
      "discount_total",
      "total",
      "items.title",
      "items.variant_title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "shipping_methods.name",
      "shipping_address.first_name",
    ],
    filters: { id: req.params.id },
  })

  const metadata = (order?.metadata ?? {}) as Record<string, unknown>
  const valid = tokenMatches(token, metadata)
  if (!order || !valid || isTokenExpired({ status: order.status, updatedAt: new Date(order.updated_at as string) })) {
    return orderAccessDenied(res)
  }

  const isTransfer = metadata.payment_method === "transfer"
  // Medusa deja el pedido en `pending` aunque el pago ya esté capturado: lo que lo dice es el comprobante aceptado.
  const accepted = await req.scope
    .resolve<TransferProofModuleService>(TRANSFER_PROOF_MODULE)
    .listTransferProofs({ order_id: order.id, status: "accepted" } as never)
  // Un pedido con tarjeta nace cuando el pago ya está aprobado (arquitectura.md, 10.2).
  const paid = accepted.length > 0 || metadata.payment_method === "card"
  const pending = order.status === "pending" && !paid
  let bank: BankAccount | null = null
  if (isTransfer && pending) {
    const {
      data: [store],
    } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
    bank = mergeSettings(store?.metadata).bank_account ?? null
  }

  res.json({
    order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      currency_code: order.currency_code,
      created_at: order.created_at,
      customer_first_name: order.shipping_address?.first_name ?? null,
      items: (order.items ?? []).map((item) => ({
        title: item?.title,
        variant_title: item?.variant_title ?? null,
        quantity: num(item?.quantity),
        unit_price: num(item?.unit_price),
        total: num(item?.total),
      })),
      shipping: { name: order.shipping_methods?.[0]?.name ?? null },
      subtotal: num(order.subtotal),
      discount_total: num(order.discount_total),
      total: num(order.total),
    },
    payment: {
      method: isTransfer ? "transfer" : (metadata.payment_method ?? null),
      reference: metadata.transfer_reference ?? null,
      due_at: pending ? (metadata.transfer_due_at ?? null) : null,
      bank_account: bank,
      status: paid ? "paid" : "pending",
    },
  })
}
