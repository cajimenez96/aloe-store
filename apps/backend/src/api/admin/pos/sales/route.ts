import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MathBN, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  addShippingMethodToCartWorkflow,
  addToCartWorkflow,
  capturePaymentWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createOrderFulfillmentWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { isStockConflict } from "../../../../lib/cart-limits/conflict"
import { logEvent } from "../../../../lib/logging/log"
import { dayBounds, summarizeSales } from "../../../../lib/pos/day"
import { parseSaleInput } from "../../../../lib/pos/sale"
import { MANUAL_PROVIDER_ID } from "../../../../lib/transfer-discount/guard"

const LOCAL_CHANNEL = "Local"

/**
 * Registrar una venta en el local (arquitectura.md, sección 14.5; planning.md,
 * HU-34). Arma un carrito en el canal "Local", lo completa con el proveedor manual,
 * captura el pago en el momento y cumple los ítems para que el stock baje. Los
 * precios los calcula Medusa: la ruta solo recibe variantes y cantidades (SEC-30).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = parseSaleInput(req.body)
  if (!parsed.ok) {
    return res.status(422).json({ type: "invalid_data", code: parsed.code, message: parsed.message })
  }
  const sale = parsed.data

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [channel],
  } = await query.graph({ entity: "sales_channel", fields: ["id", "name"], filters: { name: LOCAL_CHANNEL } })
  const {
    data: [region],
  } = await query.graph({ entity: "region", fields: ["id", "currency_code"], filters: { currency_code: "ars" } })
  const {
    data: [pickup],
  } = await query.graph({ entity: "shipping_option", fields: ["id", "name"], filters: { name: "Retiro en el local" } })
  const {
    data: [location],
  } = await query.graph({ entity: "stock_location", fields: ["id", "name"], filters: { name: "Local" } })

  if (!channel || !region || !pickup || !location) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Falta configurar el canal Local. Ejecutá `npm run setup:store`.",
      "POS_NOT_CONFIGURED"
    )
  }

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: { region_id: region.id, sales_channel_id: channel.id, currency_code: region.currency_code },
  })

  // Los ítems se agregan por el flujo normal para que corran las validaciones de
  // stock y de disponibilidad (en el canal Local no rige el máximo por variante).
  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: cart.id,
      items: sale.items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    },
  })
  await addShippingMethodToCartWorkflow(req.scope).run({
    input: { cart_id: cart.id, options: [{ id: pickup.id }] },
  })

  const { result: collection } = await createPaymentCollectionForCartWorkflow(req.scope).run({
    input: { cart_id: cart.id },
  })
  await createPaymentSessionsWorkflow(req.scope).run({
    input: { payment_collection_id: collection.id, provider_id: MANUAL_PROVIDER_ID },
  })

  let orderId: string
  try {
    const { result } = await completeCartWorkflow(req.scope).run({ input: { id: cart.id } })
    orderId = (result as { id: string }).id
  } catch (error) {
    // Otra venta se llevó la última unidad entre armar la venta y cobrarla.
    if (isStockConflict(error)) {
      return res.status(409).json({
        type: "not_allowed",
        code: "STOCK_INSUFFICIENT",
        message: JSON.stringify({ available: 0 }),
      })
    }
    throw error
  }

  const actor = req.auth_context?.actor_id ?? null
  await req.scope.resolve(Modules.ORDER).updateOrders(orderId, {
    metadata: {
      pos: true,
      pos_payment_method: sale.paymentMethod,
      sold_by: actor,
      customer_name: sale.customerName,
      customer_document: sale.customerDocument,
      note: sale.note,
    },
  })

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "created_at",
      "total",
      "currency_code",
      "items.id",
      "items.title",
      "items.variant_title",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "payment_collections.payments.id",
    ],
    filters: { id: orderId },
  })

  const payment = (order.payment_collections ?? []).flatMap((c) => c?.payments ?? [])[0]
  if (payment) {
    await capturePaymentWorkflow(req.scope).run({ input: { payment_id: payment.id, captured_by: actor ?? undefined } })
  }

  // Cumplir los ítems baja el stock físico y libera la reserva.
  await createOrderFulfillmentWorkflow(req.scope).run({
    input: {
      order_id: orderId,
      created_by: actor ?? undefined,
      location_id: location.id,
      items: (order.items ?? []).flatMap((item) => (item ? [{ id: item.id, quantity: MathBN.convert(item.quantity as never).toNumber() }] : [])),
    },
  })

  logEvent(req.scope.resolve(ContainerRegistrationKeys.LOGGER), "info", "pos_sale_registered", { actor_id: actor ?? "desconocido", order_id: order.id, payment_method: sale.paymentMethod }, req.requestId)

  res.status(201).json({
    sale: {
      order_id: order.id,
      display_id: order.display_id,
      sales_channel: channel.name,
      total: MathBN.convert(order.total as never).toNumber(),
      currency_code: order.currency_code,
      payment_method: sale.paymentMethod,
      created_at: order.created_at,
      items: (order.items ?? []).map((item) => ({
        title: item?.title,
        variant_title: item?.variant_title ?? null,
        quantity: MathBN.convert((item?.quantity ?? 0) as never).toNumber(),
        unit_price: MathBN.convert((item?.unit_price ?? 0) as never).toNumber(),
        total: MathBN.convert((item?.total ?? 0) as never).toNumber(),
      })),
    },
  })
}

/**
 * Ventas del local por día para el cierre de caja (planning.md, HU-37): total por
 * medio de pago y lista con hora y usuario. Solo incluye el canal Local. Es una
 * consulta de admin: el vendedor no la tiene habilitada.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const bounds = dayBounds(typeof req.query.date === "string" ? req.query.date : undefined)
  if (!bounds) {
    return res.status(422).json({ type: "invalid_data", code: "SALE_INVALID", message: "La fecha debe tener el formato AAAA-MM-DD." })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [channel],
  } = await query.graph({ entity: "sales_channel", fields: ["id"], filters: { name: LOCAL_CHANNEL } })
  if (!channel) return res.json({ date: req.query.date ?? null, totals: { cash: 0, transfer: 0, card: 0 }, total: 0, count: 0, sales: [] })

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "total", "status", "metadata"],
    filters: { sales_channel_id: channel.id, created_at: { $gte: bounds.from, $lt: bounds.to } },
  })

  const sold = orders.filter((order) => (order.metadata as Record<string, unknown> | null)?.pos === true && order.status !== "canceled")
  const userIds = [...new Set(sold.flatMap((order) => {
    const id = (order.metadata as Record<string, unknown>)?.sold_by
    return typeof id === "string" ? [id] : []
  }))]
  const users = userIds.length ? await req.scope.resolve(Modules.USER).listUsers({ id: userIds }) : []
  const emailOf = new Map(users.map((user) => [user.id, user.email]))

  const rows = sold
    .map((order) => {
      const meta = order.metadata as Record<string, unknown>
      return {
        displayId: Number(order.display_id),
        total: MathBN.convert(order.total as never).toNumber(),
        method: String(meta.pos_payment_method ?? ""),
        at: new Date(order.created_at as string),
        user: typeof meta.sold_by === "string" ? (emailOf.get(meta.sold_by) ?? null) : null,
      }
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  res.json({
    date: bounds.from.toISOString(),
    ...summarizeSales(rows),
    sales: rows.map((row) => ({
      display_id: row.displayId,
      total: row.total,
      payment_method: row.method,
      created_at: row.at.toISOString(),
      user: row.user,
    })),
  })
}
