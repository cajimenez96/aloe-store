import { describe, expect, it } from "vitest"
import { returnTarget, isPaymentUrl } from "../return"

describe("returnTarget (HU-24, SEC-33)", () => {
  it("un pago aprobado lleva al pedido", () => {
    expect(returnTarget({ status: "approved", order_id: "order_01ABC" })).toEqual({ kind: "order", orderId: "order_01ABC" })
  })

  it("un pago aprobado sin pedido o con un id raro no redirige a cualquier lado", () => {
    expect(returnTarget({ status: "approved" })).toEqual({ kind: "page", path: "/pago/pendiente" })
    expect(returnTarget({ status: "approved", order_id: "../admin" })).toEqual({ kind: "page", path: "/pago/pendiente" })
  })

  it("rechazado vuelve al checkout con el aviso", () => {
    expect(returnTarget({ status: "rejected" })).toEqual({ kind: "page", path: "/checkout?pago=rechazado" })
  })

  it("devuelto por falta de stock tiene su página", () => {
    expect(returnTarget({ status: "refunded" })).toEqual({ kind: "page", path: "/pago/devuelto" })
  })

  it("pendiente, error o cualquier estado desconocido espera", () => {
    for (const status of ["pending", "error", "algo-raro", undefined]) {
      expect(returnTarget({ status: status as never })).toEqual({ kind: "page", path: "/pago/pendiente" })
    }
  })
})

describe("isPaymentUrl", () => {
  it("acepta solo http y https", () => {
    expect(isPaymentUrl("https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1")).toBe(true)
    expect(isPaymentUrl("http://localhost:9400/pay/pref_1")).toBe(true)
  })
  it("rechaza lo demás", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "no es una url", "", null, undefined]) {
      expect(isPaymentUrl(bad as never)).toBe(false)
    }
  })
})
