const AR_OFFSET_HOURS = 3 // Argentina es UTC-3 todo el año

/**
 * Límites de un día en hora de Argentina (planning.md, HU-37). Sin fecha usa hoy.
 * Devuelve null si la fecha no es un día real con formato AAAA-MM-DD.
 */
export function dayBounds(date: string | undefined, now: Date = new Date()): { from: Date; to: Date } | null {
  let year: number, month: number, day: number
  if (date === undefined) {
    const local = new Date(now.getTime() - AR_OFFSET_HOURS * 3_600_000)
    year = local.getUTCFullYear()
    month = local.getUTCMonth() + 1
    day = local.getUTCDate()
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!match) return null
    ;[year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const check = new Date(Date.UTC(year, month - 1, day))
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  }
  const from = new Date(Date.UTC(year, month - 1, day, AR_OFFSET_HOURS))
  return { from, to: new Date(from.getTime() + 24 * 3_600_000) }
}

export type SaleRow = {
  displayId: number
  total: number
  method: string
  at: Date
  user: string | null
}

/** Total por medio de pago y total del día para el cierre de caja (HU-37). */
export function summarizeSales(sales: SaleRow[]) {
  const totals: Record<"cash" | "transfer" | "card", number> = { cash: 0, transfer: 0, card: 0 }
  let total = 0
  for (const sale of sales) {
    total += sale.total
    if (sale.method === "cash" || sale.method === "transfer" || sale.method === "card") {
      totals[sale.method] += sale.total
    }
  }
  return { totals, total, count: sales.length }
}
