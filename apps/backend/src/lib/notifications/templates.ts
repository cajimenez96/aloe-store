export type ShopInfo = {
  name: string
  /** Email de consultas que se muestra al pie. Sin él, no se muestra la línea. */
  contactEmail?: string | null
}

export type RenderedEmail = { subject: string; html: string; text: string }

type TemplateDefinition = {
  /** Datos de ejemplo para la vista previa y las pruebas de renderizado. */
  sample: Record<string, string>
  render: (data: Record<string, string>, shop: ShopInfo) => { subject: string; lines: string[] }
}

/** Escapa el texto que viene del cliente antes de ponerlo en HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Plantillas de los avisos. Las historias de emails (HU-39 a HU-42) agregan las
 * suyas acá: pedido pagado, datos de transferencia, comprobante recibido,
 * rechazo y cancelación.
 */
export const TEMPLATES = {
  example: {
    sample: { name: "Ana", message: "Este es un aviso de ejemplo." },
    render: (data, shop) => ({
      subject: `Aviso de ${shop.name}`,
      lines: [`Hola ${data.name}`, data.message],
    }),
  },
  "transfer-order": {
    sample: {
      name: "Ana",
      orderNumber: "1042",
      total: "$ 27.000",
      holder: "Nombre del comercio",
      cbu: "0000000000000000000000",
      alias: "comercio.alias",
      bank: "Banco de ejemplo",
      reference: "PED-1042",
      dueDate: "25/10/2026 18:30",
      link: "http://localhost:3000/pedido/order_01/acceso?token=ejemplo",
    },
    render: (data) => ({
      subject: `Pedido #${data.orderNumber}: datos para transferir`,
      lines: [
        `Hola ${data.name}`,
        `Recibimos tu pedido #${data.orderNumber}. Para pagarlo, transferí ${data.total} a esta cuenta:`,
        `Titular: ${data.holder}`,
        `CBU o CVU: ${data.cbu}`,
        `Alias: ${data.alias}`,
        `Banco: ${data.bank}`,
        `Referencia: ${data.reference}`,
        `Tenés hasta el ${data.dueDate} para transferir y subir el comprobante. Pasado ese plazo, el pedido se cancela y el stock se libera.`,
        `Seguí tu pedido y subí el comprobante acá: ${data.link}`,
      ],
    }),
  },
} satisfies Record<string, TemplateDefinition>

export type TemplateName = keyof typeof TEMPLATES

function layout(shop: ShopInfo, subject: string, lines: string[]): { html: string; text: string } {
  const paragraphs = lines.map((line) => `<p style="margin:0 0 16px">${escapeHtml(line)}</p>`).join("")
  const contactHtml = shop.contactEmail
    ? `<p style="margin:24px 0 0;color:#71717a;font-size:13px">Consultas: ${escapeHtml(shop.contactEmail)}</p>`
    : ""

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;background:#fbfbf5;font-family:Helvetica,Arial,sans-serif;color:#000">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<h1 style="margin:0 0 24px;font-size:28px;font-weight:300">${escapeHtml(shop.name)}</h1>
${paragraphs}
${contactHtml}
</div>
</body>
</html>`

  const text = [
    shop.name,
    "",
    ...lines,
    ...(shop.contactEmail ? ["", `Consultas: ${shop.contactEmail}`] : []),
  ].join("\n")

  return { html, text }
}

/** Arma el asunto, el HTML y el texto plano de un aviso con la plantilla base. */
export function renderEmail(
  template: TemplateName,
  data: Record<string, string>,
  shop: ShopInfo
): RenderedEmail {
  const definition = (TEMPLATES as Record<string, TemplateDefinition | undefined>)[template]
  if (!definition) {
    throw new Error(`No existe la plantilla de email "${template}".`)
  }
  const { subject, lines } = definition.render(data, shop)
  return { subject, ...layout(shop, subject, lines) }
}
