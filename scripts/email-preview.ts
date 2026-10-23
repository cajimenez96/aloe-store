/**
 * Vista previa local de los emails (planning.md, TEC-02).
 *
 *   npm run email:preview
 *
 * Levanta un servidor en 127.0.0.1:3900 que muestra cada plantilla con datos de
 * ejemplo. No envía nada. Se detiene con Ctrl+C.
 */
import http from "node:http"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  TEMPLATES,
  renderEmail,
  type TemplateName,
} from "../apps/backend/src/lib/notifications/templates"

const PORT = Number(process.env.EMAIL_PREVIEW_PORT ?? 3900)

export default async function emailPreview({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["name", "metadata"] })
  const store = data[0] as { name?: string; metadata?: Record<string, unknown> | null } | undefined
  const contact = store?.metadata?.admin_notification_email
  const shop = {
    name: store?.name ?? "Aloe",
    contactEmail: typeof contact === "string" ? contact : null,
  }

  const names = Object.keys(TEMPLATES) as TemplateName[]

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`)
    const name = url.pathname.slice(1) as TemplateName

    if (url.pathname === "/") {
      const links = names.map((n) => `<li><a href="/${n}">${n}</a></li>`).join("")
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(`<!doctype html><meta charset="utf-8"><title>Emails</title><h1>Plantillas</h1><ul>${links}</ul>`)
      return
    }
    if (names.includes(name)) {
      const email = renderEmail(name, TEMPLATES[name].sample, shop)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(email.html)
      return
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    res.end("No existe esa plantilla.")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Vista previa de emails: http://127.0.0.1:${PORT}  (Ctrl+C para salir)`)
      resolve()
    })
  })
  await new Promise(() => {})
}
