import { createHash } from "node:crypto"

export const MAX_PENDING_PER_EMAIL = 2
export const MAX_PENDING_PER_IP = 3
const IP_WINDOW_MS = 24 * 3_600_000

/** Minúsculas, sin espacios y sin alias `+`: ana+1@x.com cuenta como ana@x.com. */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@")
  return `${local.split("+")[0]}@${domain}`
}

type Candidate = { email?: string | null; ipHash?: string | null; status: string; createdAt: Date }

/**
 * Límite de pedidos por transferencia pendientes (seguridad.md, SEC-40): 2 por
 * email y 3 por IP en 24 horas. Devuelve cuál se superó, o null si puede seguir.
 */
export function pendingLimitReached(input: {
  orders: Candidate[]
  email: string
  ipHash: string | null
  now?: Date
}): "email" | "ip" | null {
  const now = input.now ?? new Date()
  const email = normalizeEmail(input.email)
  const pending = input.orders.filter((order) => order.status === "pending")

  const byEmail = pending.filter((order) => normalizeEmail(order.email ?? "") === email)
  if (byEmail.length >= MAX_PENDING_PER_EMAIL) return "email"

  if (input.ipHash) {
    const byIp = pending.filter(
      (order) =>
        order.ipHash === input.ipHash && now.getTime() - order.createdAt.getTime() <= IP_WINDOW_MS
    )
    if (byIp.length >= MAX_PENDING_PER_IP) return "ip"
  }
  return null
}

/** Se guarda el hash de la IP, no la IP (seguridad.md, SEC-70). */
export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null
  return createHash("sha256").update(`order-ip:${ip}`).digest("hex")
}
