import { Module } from "@medusajs/framework/utils"
import TransferProofModuleService from "./service"

export const TRANSFER_PROOF_MODULE = "transferProof"

export default Module(TRANSFER_PROOF_MODULE, {
  service: TransferProofModuleService,
})
