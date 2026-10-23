export type ColorEntry = {
  option_value_id: string
  value: string
  hex: string | null
}

type OptionValueLike = {
  id?: string
  value?: string
  product_color?: { hex?: string | null } | null
} | null

type OptionLike = { title?: string; values?: OptionValueLike[] | null } | null

/** Campos que hay que pedirle a Medusa para poder extraer las muestras. */
export const COLOR_FIELDS = [
  "id",
  "options.title",
  "options.values.id",
  "options.values.value",
  "options.values.product_color.hex",
]

/**
 * Valores de la opción "Color" de un producto con su muestra (`hex`), o null si
 * el valor todavía no tiene una. La opción se reconoce por su título, sin
 * distinguir mayúsculas ni espacios.
 */
export function extractColors(product: unknown): ColorEntry[] {
  const options = (product as { options?: OptionLike[] | null } | undefined)?.options
  if (!Array.isArray(options)) {
    return []
  }

  return options
    .filter((option) => option?.title?.trim().toLowerCase() === "color")
    .flatMap((option) => option?.values ?? [])
    .filter((value): value is NonNullable<OptionValueLike> => Boolean(value?.id))
    .map((value) => ({
      option_value_id: value.id as string,
      value: value.value ?? "",
      hex: value.product_color?.hex ?? null,
    }))
}
