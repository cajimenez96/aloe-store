import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import { logEvent } from "../../lib/logging/log"
import { describeNotification } from "./describe"

type Options = { channels?: string[] }

/**
 * Proveedor de notificaciones del MVP0: no envía nada, solo deja constancia en el
 * log sin datos personales (planning.md, TEC-02 y HU-49). Al desplegar se reemplaza
 * por el proveedor real de emails (TEC-05).
 */
export class LogNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-log"

  protected logger_: Logger

  constructor({ logger }: { logger: Logger }, _options: Options) {
    super()
    this.logger_ = logger
  }

  async send(notification: NotificationTypes.ProviderSendNotificationDTO): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No notification information provided")
    }
    logEvent(this.logger_ as never, "info", "email_logged", describeNotification(notification as never, process.env.LOG_EMAIL_BODIES === "true"))
    return {}
  }
}
