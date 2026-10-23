import { Module } from "@medusajs/framework/utils"
import ProductColorModuleService from "./service"

export const PRODUCT_COLOR_MODULE = "productColor"

export default Module(PRODUCT_COLOR_MODULE, {
  service: ProductColorModuleService,
})
