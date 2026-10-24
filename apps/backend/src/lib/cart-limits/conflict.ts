/**
 * Reconoce el error con el que Medusa rechaza una compra cuando otra se llevó la
 * última unidad entre que se agregó al carrito y se confirmó (planning.md, HU-47).
 * Los workflows pueden reconstruir el error como objeto plano, por eso no se exige
 * que sea una instancia de MedusaError.
 */
export function isStockConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (typeof code === "string" && code.toLowerCase() === "insufficient_inventory") return true
  return typeof message === "string" && /not enough stock|does not have the required inventory/i.test(message)
}
