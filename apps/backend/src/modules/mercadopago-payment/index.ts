import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { MercadoPagoPaymentService } from "./service"

export default ModuleProvider(Modules.PAYMENT, { services: [MercadoPagoPaymentService] })
