import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import ProductColorModule from "../modules/product-color"

// Un valor de opción tiene como máximo una muestra de color.
export default defineLink(
  ProductModule.linkable.productOptionValue,
  ProductColorModule.linkable.productColor
)
