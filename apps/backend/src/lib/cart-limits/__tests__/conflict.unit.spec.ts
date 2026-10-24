import { MedusaError } from "@medusajs/framework/utils"
import { isStockConflict } from "../conflict"

describe("isStockConflict (HU-47)", () => {
  it("reconoce el error nativo de Medusa cuando otra compra se llevó la unidad", () => {
    expect(isStockConflict(new MedusaError(MedusaError.Types.NOT_ALLOWED, "Not enough stock available for item iitem_01ABC"))).toBe(true)
    expect(
      isStockConflict(new MedusaError(MedusaError.Types.NOT_ALLOWED, "Some variant does not have the required inventory", "insufficient_inventory"))
    ).toBe(true)
  })

  it("no confunde otros errores", () => {
    expect(isStockConflict(new Error("conexión rechazada"))).toBe(false)
    expect(isStockConflict(new MedusaError(MedusaError.Types.NOT_FOUND, "Cart not found"))).toBe(false)
    expect(isStockConflict(null)).toBe(false)
    expect(isStockConflict("texto")).toBe(false)
  })

  it("reconoce un error con forma de objeto aunque no sea MedusaError (los workflows lo reconstruyen)", () => {
    expect(isStockConflict({ type: "not_allowed", message: "Not enough stock available for item x" })).toBe(true)
    expect(isStockConflict({ code: "insufficient_inventory", message: "x" })).toBe(true)
  })
})
