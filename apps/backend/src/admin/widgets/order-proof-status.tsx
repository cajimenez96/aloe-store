import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Proof = {
  id: string
  status: "pending_review" | "accepted" | "rejected"
  created_at: string
  rejection_reason: string | null
  file_url: string
}

const LABEL = {
  pending_review: { text: "En revisión", color: "orange" },
  accepted: { text: "Aceptado", color: "green" },
  rejected: { text: "Rechazado", color: "red" },
} as const

/**
 * Bloque del detalle del pedido con el estado del último comprobante de
 * transferencia y un acceso a él (planning.md, HU-32). Solo aparece si el pedido
 * tiene comprobantes.
 */
const OrderProofStatus = ({ data }: { data: { id: string } }) => {
  const [proofs, setProofs] = useState<Proof[] | null>(null)

  useEffect(() => {
    void fetch(`/admin/transfer-proofs?status=all&order_id=${encodeURIComponent(data.id)}`, { credentials: "include" })
      .then(async (response) => (response.ok ? (await response.json()).transfer_proofs : []))
      .then(setProofs)
      .catch(() => setProofs([]))
  }, [data.id])

  if (!proofs || proofs.length === 0) return null
  const latest = proofs[proofs.length - 1]
  const label = LABEL[latest.status]

  return (
    <Container className="flex flex-col gap-y-2 p-6">
      <div className="flex items-center justify-between">
        <Heading level="h2">Comprobante de transferencia</Heading>
        <Badge color={label.color}>{label.text}</Badge>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        Recibido el {new Date(latest.created_at).toLocaleString("es-AR")} · {proofs.length} {proofs.length === 1 ? "subida" : "subidas"}
      </Text>
      {latest.status === "rejected" && latest.rejection_reason && (
        <Text size="small">Motivo del rechazo: {latest.rejection_reason}</Text>
      )}
      <div className="flex gap-x-4">
        <a href={latest.file_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive underline">
          Abrir comprobante
        </a>
        <a href="/app/comprobantes" className="text-ui-fg-interactive underline">
          Ir a la cola de revisión
        </a>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "order.details.side.after" })

export default OrderProofStatus
