import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { LogNotificationService } from "./service"

export default ModuleProvider(Modules.NOTIFICATION, { services: [LogNotificationService] })
