"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { getEnv } from "../env"
import { getRegion } from "../data"
import { cartFetch, getCart, getPublishedProductIds, readCartId } from "./api"
import {
  buildCartView,
  CART_COOKIE,
  type CartError,
  cartCookieOptions,
  findUnavailableLines,
  parseCartInput,
} from "./model"

export type CartActionResult = { ok: true } | { ok: false; error: CartError }

const INVALID_ERROR: CartError = {
  code: "CART_ERROR",
  message: "No pudimos actualizar el carrito. Probá de nuevo en un momento.",
}
const INVALID: CartActionResult = { ok: false, error: INVALID_ERROR }

const LINE_ID = /^[A-Za-z0-9_]{1,100}$/

async function ensureCartId(): Promise<{ id: string } | { error: CartError }> {
  const existing = await readCartId()
  if (existing) {
    const found = await cartFetch<{ cart: { completed_at?: string | null } }>(`/store/carts/${existing}`)
    if (found.ok && !found.body.cart.completed_at) return { id: existing }
  }

  const region = await getRegion()
  if (!region) return { error: INVALID_ERROR }
  const created = await cartFetch<{ cart: { id: string } }>("/store/carts", {
    method: "POST",
    body: { region_id: region.id },
  })
  if (!created.ok) return { error: created.error }

  ;(await cookies()).set(CART_COOKIE, created.body.cart.id, cartCookieOptions(getEnv().backendUrl))
  return { id: created.body.cart.id }
}

function done(result: CartActionResult): CartActionResult {
  revalidatePath("/", "layout")
  return result
}

export async function addToCart(raw: unknown): Promise<CartActionResult> {
  const input = parseCartInput(raw)
  if (!input) return INVALID

  const cart = await ensureCartId()
  if ("error" in cart) return { ok: false, error: cart.error }

  const result = await cartFetch(`/store/carts/${cart.id}/line-items`, {
    method: "POST",
    body: { variant_id: input.variantId, quantity: input.quantity },
  })
  return done(result.ok ? { ok: true } : { ok: false, error: result.error })
}

export async function updateLineQuantity(lineId: unknown, quantity: unknown): Promise<CartActionResult> {
  const parsed = parseCartInput({ variantId: "x", quantity })
  if (typeof lineId !== "string" || !LINE_ID.test(lineId) || !parsed) return INVALID

  const cartId = await readCartId()
  if (!cartId) return INVALID

  const result = await cartFetch(`/store/carts/${cartId}/line-items/${lineId}`, {
    method: "POST",
    body: { quantity: parsed.quantity },
  })
  return done(result.ok ? { ok: true } : { ok: false, error: result.error })
}

export async function removeLine(lineId: unknown): Promise<CartActionResult> {
  if (typeof lineId !== "string" || !LINE_ID.test(lineId)) return INVALID

  const cartId = await readCartId()
  if (!cartId) return INVALID

  const result = await cartFetch(`/store/carts/${cartId}/line-items/${lineId}`, { method: "DELETE" })
  return done(result.ok ? { ok: true } : { ok: false, error: result.error })
}

/** Agrega una unidad de una variante desde la ficha de producto. */
export async function addOneToCart(variantId: unknown): Promise<CartActionResult> {
  return addToCart({ variantId, quantity: 1 })
}

/**
 * Quita del carrito las variantes que se despublicaron y devuelve sus nombres
 * para avisar al cliente (planning.md, HU-18). Recalcula todo en el servidor: no
 * recibe nada del navegador.
 */
export async function dropUnavailableLines(): Promise<{ removed: string[] }> {
  const cartId = await readCartId()
  const cart = buildCartView(await getCart())
  if (!cartId || cart.lines.length === 0) return { removed: [] }

  const published = await getPublishedProductIds(cart.lines.map((line) => line.productId))
  const gone = findUnavailableLines(cart.lines, published)

  const removed: string[] = []
  for (const line of gone) {
    const result = await cartFetch(`/store/carts/${cartId}/line-items/${line.id}`, { method: "DELETE" })
    if (result.ok) removed.push(line.title)
  }
  if (removed.length > 0) revalidatePath("/", "layout")
  return { removed }
}
