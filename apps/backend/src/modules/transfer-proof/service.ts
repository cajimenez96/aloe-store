import { MedusaService } from "@medusajs/framework/utils"
import TransferProof from "./models/transfer-proof"

class TransferProofModuleService extends MedusaService({
  TransferProof,
}) {}

export default TransferProofModuleService
