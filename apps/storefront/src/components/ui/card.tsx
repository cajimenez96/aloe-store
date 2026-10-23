import * as React from "react"
import { cn } from "@/lib/utils"

/** Tarjeta de la pista transaccional: fondo claro, borde fino y radio de 12 px. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-lg border border-hairline bg-canvas-light text-ink", className)}
      {...props}
    />
  )
}
