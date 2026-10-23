"use client"

import { ColorSwatch } from "@/components/product/color-swatch"
import { cn } from "@/lib/utils"
import {
  isValueAvailable,
  isValueInStock,
  type Selection,
  type SelectorVariant,
} from "@/lib/variants"

export type SelectorOption = {
  id: string
  title: string
  values: { id: string; value: string; hex?: string | null }[]
}

type VariantSelectorProps = {
  options: SelectorOption[]
  variants: SelectorVariant[]
  selection: Selection
  onChange: (optionId: string, value: string) => void
}

const isColorOption = (title: string) => title.trim().toLowerCase() === "color"

/**
 * Selector de talle, color u otras opciones. Usa botones de radio nativos: el
 * teclado (flechas y tabulador) y los lectores de pantalla funcionan sin código
 * extra. Solo se pueden elegir combinaciones que existen como variante; un valor
 * sin stock se puede elegir pero se marca como agotado.
 */
export function VariantSelector({ options, variants, selection, onChange }: VariantSelectorProps) {
  return (
    <div className="flex flex-col gap-6">
      {options.map((option) => (
        <fieldset key={option.id} className="flex flex-col gap-3">
          <legend className="mb-3 text-sm text-shade-60">{option.title}</legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((item) => {
              const available = isValueAvailable(variants, selection, option.id, item.value)
              const inStock = isValueInStock(variants, selection, option.id, item.value)
              const checked = selection[option.id] === item.value
              const inputId = `${option.id}-${item.id}`
              return (
                <div key={item.id}>
                  <input
                    id={inputId}
                    type="radio"
                    name={option.id}
                    value={item.value}
                    checked={checked}
                    disabled={!available}
                    onChange={() => onChange(option.id, item.value)}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 py-2 text-sm",
                      "border-hairline bg-canvas-light text-ink",
                      "peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white",
                      // La muestra necesita borde claro sobre el fondo negro del valor elegido.
                      "peer-checked:[&_[data-swatch]]:border-white",
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink",
                      "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
                      available && !inStock && "text-shade-50"
                    )}
                  >
                    {isColorOption(option.title) ? (
                      <ColorSwatch name={item.value} hex={item.hex} struck={available && !inStock} />
                    ) : (
                      <span className={cn(available && !inStock && "line-through")}>{item.value}</span>
                    )}
                    {available && !inStock && <span className="text-xs">(agotado)</span>}
                  </label>
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
