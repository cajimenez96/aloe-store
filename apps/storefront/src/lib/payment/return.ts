import { isOrderId } from "../order/model"

export type PaymentStatusReply = {
  status?: "approved" | "pending" | "rejected" | "refunded" | "error"
  order_id?: string
}

export type ReturnTarget = { kind: "order"; orderId: string } | { kind: "page"; path: string }

/**
 * A dónde lleva al cliente la verificación de su pago con tarjeta (planning.md, HU-24).
 * Solo cuenta lo que responde el backend, que consultó a Mercado Pago: nada de lo que
 * venga en la URL de regreso cambia un estado (seguridad.md, SEC-33).
 */
export function returnTarget(reply: PaymentStatusReply): ReturnTarget {
  switch (reply.status) {
    case "approved":
      return reply.order_id && isOrderId(reply.order_id)
        ? { kind: "order", orderId: reply.order_id }
        : { kind: "page", path: "/pago/pendiente" }
    case "rejected":
      return { kind: "page", path: "/checkout?pago=rechazado" }
    case "refunded":
      return { kind: "page", path: "/pago/devuelto" }
    default:
      return { kind: "page", path: "/pago/pendiente" }
  }
}

/** El enlace de pago que manda el backend: solo http(s), nunca un esquema ejecutable. */
export function isPaymentUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}
