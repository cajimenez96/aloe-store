"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { uploadProof, type ProofUploadState } from "@/lib/order/proof-actions"

const INITIAL: ProofUploadState = { ok: false, message: null }

/** Subida del comprobante de transferencia (JPG, PNG o PDF de hasta 5 MB). */
export function ProofUpload({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(uploadProof.bind(null, orderId), INITIAL)

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="proof-file" className="text-sm">
        Comprobante (JPG, PNG o PDF, hasta 5 MB)
      </label>
      <input
        id="proof-file"
        name="file"
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        required
        aria-describedby="proof-message"
        className="min-h-11 rounded-md border border-hairline bg-canvas-light px-4 py-2 text-base"
      />
      <div id="proof-message" role={state.ok ? "status" : "alert"} aria-live="polite" className="min-h-5 text-sm">
        {state.message}
      </div>
      <Button type="submit" disabled={pending} className="w-full md:w-auto">
        {pending ? "Subiendo…" : "Subir comprobante"}
      </Button>
    </form>
  )
}
