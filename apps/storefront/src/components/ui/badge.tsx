import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

/** Etiqueta pill. El verde aloe es relleno de superficie, nunca color de texto. */
const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-3 py-1 text-xs tracking-wide text-ink",
  {
    variants: {
      variant: { aloe: "bg-aloe", neutral: "bg-shade-30" },
    },
    defaultVariants: { variant: "aloe" },
  }
)

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
