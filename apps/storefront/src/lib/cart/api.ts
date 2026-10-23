import { cookies } from "next/headers"
import { getEnv } from "../env"
import { CART_COOKIE, type CartError, type CartInput, parseCartError } from "./model"

type Result<T> = { ok: true; body: T } | { ok: false; error: CartError }

/**
 * Llamada a la API de carrito de Medusa. Se usa `fetch` y no el SDK porque el SDK
 * descarta el `code` del error, que es el contrato de arquitectura.md, 15.2.
 * Solo viajan identificadores y cantidades (seguridad.md, SEC-30).
 */
export async function cartFetch<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}
): Promise<Result<T>> {
  const { backendUrl, publishableKey } = getEnv()
  try {
    const response = await fetch(`${backendUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "x-publishable-api-key": publishableKey,
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    })
    const body = (await response.json().catch(() => ({}))) as T & { code?: string; message?: string }
    if (!response.ok) {
      return { ok: false, error: parseCartError(body) }
    }
    return { ok: true, body }
  } catch {
    return {
      ok: false,
      error: { code: "STORE_UNAVAILABLE", message: "No pudimos conectar con la tienda. Probá de nuevo." },
    }
  }
}

export async function readCartId(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value
  return value && /^[A-Za-z0-9_]{1,100}$/.test(value) ? value : null
}

// Medusa no devuelve el total de cada línea ni la miniatura salvo que se pidan.
const CART_FIELDS = encodeURIComponent("+items.total,+items.thumbnail,+items.product_handle,+items.product_id")

type CartResponse = { cart: CartInput & { completed_at?: string | null } }

/** El carrito de la cookie, o null si no hay, no existe más o ya se completó. */
export async function getCart() {
  const id = await readCartId()
  if (!id) return null
  const result = await cartFetch<CartResponse>(`/store/carts/${id}?fields=${CART_FIELDS}`)
  if (!result.ok || result.body.cart.completed_at) return null
  return result.body.cart
}

/** Ids de los productos del carrito que siguen publicados en la tienda. */
export async function getPublishedProductIds(productIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (ids.length === 0) return new Set()
  const query = ids.map((id) => `id=${encodeURIComponent(id)}`).join("&")
  const result = await cartFetch<{ products: { id: string }[] }>(
    `/store/products?${query}&fields=id&limit=${ids.length}`
  )
  // Si la consulta falla no se quita nada: es más seguro dejar la línea que perderla por un error de red.
  if (!result.ok) return new Set(ids)
  return new Set(result.body.products.map((product) => product.id))
}
