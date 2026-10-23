import { model } from "@medusajs/framework/utils"

// Muestra visual de un valor de la opción "Color". El vínculo con
// ProductOptionValue está en src/links/option-value-color.ts.
const ProductColor = model.define("product_color", {
  id: model.id().primaryKey(),
  hex: model.text(),
})

export default ProductColor
