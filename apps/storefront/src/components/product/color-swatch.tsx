import { cn } from "@/lib/utils"

type ColorSwatchProps = {
  name: string
  /** Color en formato #RRGGBB. Sin muestra se ve el nombre con un borde neutro. */
  hex?: string | null
  className?: string
}

/**
 * Muestra de color con su nombre. El nombre siempre se ve: el color solo no
 * alcanza (planning.md, HU-14).
 */
export function ColorSwatch({ name, hex, className }: ColorSwatchProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        data-testid="swatch"
        className={cn(
          "size-5 shrink-0 rounded-full border",
          hex ? "border-black/15" : "border-dashed border-shade-40"
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      />
      <span>{name}</span>
    </span>
  )
}
