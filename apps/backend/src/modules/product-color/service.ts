import { MedusaService } from "@medusajs/framework/utils"
import ProductColor from "./models/product-color"

class ProductColorModuleService extends MedusaService({
  ProductColor,
}) {}

export default ProductColorModuleService
