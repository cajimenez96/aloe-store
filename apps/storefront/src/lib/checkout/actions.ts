"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getEnv } from "../env"
import { CART_COOKIE } from "../cart/model"
import { isOrderId, isOrderToken, orderCookieName, orderCookieOptions } from "../order/model"
import type { CartActionResult } from "../cart/actions"
import { cartFetch, readCartId } from "../cart/api"
import { getShippingChoices } from "./api"
import { type CheckoutField, parseCheckoutForm } from "./schema"
import type { CheckoutState } from "./state"

const FIELDS: CheckoutField[] = [
  "name",
  "email",
  "phone",
  "document",
  "shippingOptionId",
  "street",
  "city",
  "province",
  "postalCode",
]

/**
 * Guarda los datos del invitado y la forma de entrega en el carrito de Medusa
 * (planning.md, HU-19 y HU-20). La opción de entrega se busca entre las del
 * carrito: lo que manda el navegador solo elige una, no define su precio.
 */
export async function saveCheckout(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values: CheckoutState["values"] = {}
  for (const field of FIELDS) {
    const value = formData.get(field)
    if (typeof value === "string") values[field] = value.slice(0, 300)
  }

  const fail = (message: string, errors: CheckoutState["errors"] = {}): CheckoutState => ({
    saved: false,
    errors,
    values,
    message,
  })

  const cartId = await readCartId()
  if (!cartId) return fail("Tu carrito está vacío.")

  const choices = await getShippingChoices(cartId)
  const choice = choices.find((c) => c.id === values.shippingOptionId)
  if (!choice) {
    return fail("Elegí cómo querés recibir tu compra.", {
      shippingOptionId: "Elegí cómo querés recibir tu compra.",
    })
  }

  const parsed = parseCheckoutForm(values, choice.kind)
  if (!parsed.ok) return fail("Revisá los datos marcados.", parsed.errors)
  const { data } = parsed

  const updated = await cartFetch(`/store/carts/${cartId}`, {
    method: "POST",
    body: {
      email: data.email,
      shipping_address: {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        country_code: "ar",
        ...(data.address
          ? {
              address_1: data.address.street,
              city: data.address.city,
              province: data.address.province,
              postal_code: data.address.postalCode,
            }
          : { address_1: "", city: "", province: "", postal_code: "" }),
      },
      metadata: { customer_document: data.document },
    },
  })
  if (!updated.ok) return fail(updated.error.message)

  const method = await cartFetch(`/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    body: { option_id: choice.id },
  })
  if (!method.ok) return fail(method.error.message)

  revalidatePath("/checkout")
  return { saved: true, errors: {}, values, message: null }
}

/**
 * Elegir tarjeta o transferencia (planning.md, HU-21). El storefront solo manda
 * qué medio quiere: la promoción y el total los resuelve el backend (SEC-31).
 */
export async function choosePaymentMethod(method: unknown): Promise<CartActionResult> {
  if (method !== "card" && method !== "transfer") {
    return { ok: false, error: { code: "CART_ERROR", message: "Elegí tarjeta o transferencia." } }
  }
  const cartId = await readCartId()
  if (!cartId) return { ok: false, error: { code: "CART_ERROR", message: "Tu carrito está vacío." } }

  const result = await cartFetch(`/store/checkout/${cartId}/payment-method`, {
    method: "POST",
    body: { method },
  })
  revalidatePath("/checkout")
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

/**
 * Confirma el pedido por transferencia (planning.md, HU-23 y HU-27). El token de
 * acceso llega una sola vez: se guarda en una cookie HttpOnly propia del pedido y
 * el carrito deja de existir en el navegador.
 */
export async function placeOrder(): Promise<CartActionResult> {
  const cartId = await readCartId()
  if (!cartId) return { ok: false, error: { code: "CART_ERROR", message: "Tu carrito está vacío." } }

  const result = await cartFetch<{ order_id: string; token: string }>(`/store/checkout/${cartId}/complete`, {
    method: "POST",
  })
  if (!result.ok) return { ok: false, error: result.error }

  const { order_id, token } = result.body
  if (!isOrderId(order_id) || !isOrderToken(token)) {
    return { ok: false, error: { code: "CART_ERROR", message: "No pudimos confirmar el pedido. Probá de nuevo." } }
  }

  const store = await cookies()
  store.set(orderCookieName(order_id), token, orderCookieOptions(getEnv().backendUrl))
  store.delete(CART_COOKIE)
  revalidatePath("/", "layout")
  redirect(`/pedido/${order_id}`)
}
