import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Botón de la guía de diseño: siempre pill. Primario negro, contorno y aloe para
 * la acción destacada (docs/DESIGN.md, sección Buttons).
 */
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill text-base font-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-shade-70 active:bg-shade-70",
        outline:
          "border border-ink bg-canvas-light text-ink hover:bg-canvas active:bg-canvas",
        aloe: "bg-aloe text-ink hover:brightness-95 active:brightness-90",
      },
      size: {
        default: "px-6 py-3",
        sm: "min-h-9 px-4 py-2 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
