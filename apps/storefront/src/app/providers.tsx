"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * TanStack Query solo para datos que se consultan desde el navegador después de
 * cargar la página, como el estado del comprobante (arquitectura.md, sección 18).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
