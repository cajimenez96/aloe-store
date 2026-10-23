/** Variante con lo mínimo que necesita el selector. */
export type SelectorVariant = {
  id: string
  inStock: boolean
  options: { option_id: string; value: string }[]
}

/** Valores elegidos hasta ahora, por identificador de opción. */
export type Selection = Record<string, string>

const matches = (variant: SelectorVariant, selection: Selection, skipOptionId?: string) =>
  Object.entries(selection).every(
    ([optionId, value]) =>
      optionId === skipOptionId ||
      variant.options.some((o) => o.option_id === optionId && o.value === value)
  )

/**
 * Devuelve la variante exacta cuando están elegidas todas las opciones del
 * producto, o null si falta elegir alguna o esa combinación no existe.
 */
export function findVariant(
  variants: SelectorVariant[],
  selection: Selection,
  optionCount: number
): SelectorVariant | null {
  if (Object.keys(selection).length < optionCount) {
    return null
  }
  return variants.find((variant) => matches(variant, selection)) ?? null
}

/**
 * Un valor se puede elegir si existe alguna variante que lo tenga y respete lo
 * ya elegido en las otras opciones. Una variante agotada cuenta como existente:
 * el valor se elige y se marca como agotado (planning.md, HU-14).
 */
export function isValueAvailable(
  variants: SelectorVariant[],
  selection: Selection,
  optionId: string,
  value: string
): boolean {
  return variants.some(
    (variant) =>
      variant.options.some((o) => o.option_id === optionId && o.value === value) &&
      matches(variant, selection, optionId)
  )
}

/**
 * Hay stock para un valor si alguna variante compatible con lo ya elegido lo
 * tiene. Sirve para marcar un valor como agotado sin impedir elegirlo.
 */
export function isValueInStock(
  variants: SelectorVariant[],
  selection: Selection,
  optionId: string,
  value: string
): boolean {
  return variants.some(
    (variant) =>
      variant.inStock &&
      variant.options.some((o) => o.option_id === optionId && o.value === value) &&
      matches(variant, selection, optionId)
  )
}
