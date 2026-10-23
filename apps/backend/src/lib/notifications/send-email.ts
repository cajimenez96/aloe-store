import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { withRetry } from "./retry"
import { renderEmail, type ShopInfo, type TemplateName } from "./templates"

const ATTEMPTS = 3

export type EmailMessage = {
  to: string
  template: TemplateName
  data: Record<string, string>
}

type SendOptions = { sleep?: (ms: number) => Promise<void> }

async function readShop(container: MedusaContainer): Promise<ShopInfo> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "store", fields: ["name", "metadata"] })
  const store = data[0] as { name?: string; metadata?: Record<string, unknown> | null } | undefined
  const contact = store?.metadata?.admin_notification_email
  return {
    name: store?.name ?? "Aloe",
    contactEmail: typeof contact === "string" ? contact : null,
  }
}

/**
 * Envía un aviso por email desde un suscriptor (arquitectura.md, sección 19).
 * Reintenta 3 veces con espera creciente y registra cada fallo sin el
 * destinatario ni los datos del cliente (seguridad.md, SEC-70). Si todos los
 * intentos fallan devuelve false: un email caído no debe romper el pedido.
 *
 * En el MVP0 el proveedor es el local de Medusa, que solo registra el aviso en la
 * terminal y no envía nada.
 */
export async function sendEmail(
  container: MedusaContainer,
  message: EmailMessage,
  options: SendOptions = {}
): Promise<boolean> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const email = renderEmail(message.template, message.data, await readShop(container))
    const notifications = container.resolve(Modules.NOTIFICATION)

    await withRetry(
      () =>
        notifications.createNotifications({
          to: message.to,
          channel: "email",
          template: message.template,
          data: { subject: email.subject, html: email.html, text: email.text },
        }),
      {
        attempts: ATTEMPTS,
        sleep: options.sleep,
        onFailure: (attempt, error) =>
          logger.error(
            JSON.stringify({
              event: "email_failed",
              template: message.template,
              attempt,
              reason: error instanceof Error ? error.message : "desconocido",
            })
          ),
      }
    )
    return true
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "email_gave_up",
        template: message.template,
        reason: error instanceof Error ? error.message : "desconocido",
      })
    )
    return false
  }
}
