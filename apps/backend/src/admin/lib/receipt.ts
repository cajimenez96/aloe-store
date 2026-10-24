export type ReceiptSale = {
  display_id: number
  total: number
  currency_code: string
  payment_method: string
  created_at: string
  items: { title: string; variant_title: string | null; quantity: number; unit_price: number; total: number }[]
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export const paymentLabel = (method: string) =>
  ({ cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta" })[method] ?? method

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: currency.toUpperCase() }).format(amount)

/**
 * Comprobante de la venta para imprimir desde el navegador (planning.md, HU-36).
 * Es un documento aparte, no el panel: dice "Documento no fiscal" y no tiene datos
 * del cliente.
 */
export function buildReceiptHtml(sale: ReceiptSale, shopName: string): string {
  const rows = sale.items
    .map(
      (item) =>
        `<tr><td>${item.quantity} × ${escapeHtml(item.title)}${item.variant_title ? ` (${escapeHtml(item.variant_title)})` : ""}</td><td class="r">${escapeHtml(money(item.total, sale.currency_code))}</td></tr>`
    )
    .join("")
  const date = new Date(sale.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Venta #${sale.display_id}</title>
<style>
  body{font-family:Helvetica,Arial,sans-serif;max-width:320px;margin:24px auto;color:#000;font-size:14px}
  h1{font-size:18px;margin:0 0 4px}
  .nf{font-weight:bold;text-transform:uppercase;letter-spacing:.04em;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  td{padding:4px 0;vertical-align:top}
  .r{text-align:right;white-space:nowrap}
  .total td{border-top:1px solid #000;font-weight:bold;padding-top:8px}
  .muted{color:#555}
</style>
</head>
<body>
<h1>${escapeHtml(shopName)}</h1>
<p class="nf">Documento no fiscal</p>
<p class="muted">Venta #${sale.display_id}<br>${escapeHtml(date)}</p>
<table>${rows}<tr class="total"><td>Total</td><td class="r">${escapeHtml(money(sale.total, sale.currency_code))}</td></tr></table>
<p>Medio de pago: ${escapeHtml(paymentLabel(sale.payment_method))}</p>
<p class="muted">Gracias por tu compra.</p>
</body>
</html>`
}
