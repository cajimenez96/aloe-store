import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Label, Table, Text, Textarea, Toaster, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Proof = {
  id: string
  status: "pending_review" | "accepted" | "rejected"
  mime: string
  size: number
  created_at: string
  rejection_reason: string | null
  duplicate_in_other_order: boolean
  order: { id: string; display_id: number; email: string | null; total: number; currency_code: string } | null
  file_url: string
}

const TABS: { key: Proof["status"]; label: string }[] = [
  { key: "pending_review", label: "En revisión" },
  { key: "accepted", label: "Aceptados" },
  { key: "rejected", label: "Rechazados" },
]

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: currency.toUpperCase() }).format(amount)

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, json }
}

const MESSAGES: Record<string, string> = {
  ROLE_NOT_ALLOWED: "Tu rol no permite revisar comprobantes.",
  TRANSFER_PROOF_NOT_REVIEWABLE: "Este comprobante ya fue revisado.",
  REJECTION_REASON_REQUIRED: "Escribí un motivo de 10 a 300 caracteres.",
}

/**
 * Cola de comprobantes de transferencia (planning.md, HU-29). Los más antiguos
 * primero. El vendedor ve la lista, pero aceptar y rechazar responde ROLE_NOT_ALLOWED.
 */
const ProofsPage = () => {
  const [tab, setTab] = useState<Proof["status"]>("pending_review")
  const [proofs, setProofs] = useState<Proof[] | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setProofs(null)
    const { ok, json } = await call(`/admin/transfer-proofs?status=${tab}`, "GET")
    if (ok) setProofs(json.transfer_proofs)
    else {
      setProofs([])
      toast.error("No se pudo cargar la lista.")
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (id: string, action: "accept" | "reject", body?: unknown) => {
    setBusy(true)
    const { ok, json } = await call(`/admin/transfer-proofs/${id}/${action}`, "POST", body ?? {})
    setBusy(false)
    if (ok) {
      toast.success(action === "accept" ? "Pago confirmado." : "Comprobante rechazado.")
      setRejecting(null)
      setReason("")
      await load()
    } else {
      toast.error(MESSAGES[json.code as string] ?? "No se pudo completar la acción.")
    }
  }

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      <Toaster />
      <div>
        <Heading level="h1">Comprobantes de transferencia</Heading>
        <Text className="text-ui-fg-subtle">Aceptar confirma el pago del pedido. Rechazar le explica el motivo al cliente.</Text>
      </div>

      <div className="flex gap-x-2" role="tablist">
        {TABS.map((item) => (
          <Button
            key={item.key}
            role="tab"
            aria-selected={tab === item.key}
            size="small"
            variant={tab === item.key ? "primary" : "secondary"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {proofs === null ? (
        <Text>Cargando…</Text>
      ) : proofs.length === 0 ? (
        <Text className="text-ui-fg-subtle">No hay comprobantes en esta lista.</Text>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Pedido</Table.HeaderCell>
              <Table.HeaderCell>Cliente</Table.HeaderCell>
              <Table.HeaderCell>Total</Table.HeaderCell>
              <Table.HeaderCell>Recibido</Table.HeaderCell>
              <Table.HeaderCell>Comprobante</Table.HeaderCell>
              <Table.HeaderCell>Acciones</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {proofs.map((proof) => (
              <Table.Row key={proof.id}>
                <Table.Cell>#{proof.order?.display_id ?? "—"}</Table.Cell>
                <Table.Cell>{proof.order?.email ?? "—"}</Table.Cell>
                <Table.Cell>{proof.order ? money(proof.order.total, proof.order.currency_code) : "—"}</Table.Cell>
                <Table.Cell>{new Date(proof.created_at).toLocaleString("es-AR")}</Table.Cell>
                <Table.Cell>
                  <div className="flex flex-col gap-y-1">
                    <a href={proof.file_url} target="_blank" rel="noreferrer" className="text-ui-fg-interactive underline">
                      {proof.mime === "application/pdf" ? "Descargar PDF" : "Abrir imagen"}
                    </a>
                    {proof.duplicate_in_other_order && <Badge color="orange">Ya usado en otro pedido</Badge>}
                    {proof.status === "rejected" && proof.rejection_reason && (
                      <Text size="small" className="text-ui-fg-subtle">
                        Motivo: {proof.rejection_reason}
                      </Text>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {proof.status === "pending_review" ? (
                    rejecting === proof.id ? (
                      <div className="flex flex-col gap-y-2">
                        <Label htmlFor={`reason-${proof.id}`}>Motivo (10 a 300 caracteres)</Label>
                        <Textarea
                          id={`reason-${proof.id}`}
                          value={reason}
                          maxLength={300}
                          onChange={(event) => setReason(event.target.value)}
                        />
                        <div className="flex gap-x-2">
                          <Button size="small" variant="danger" isLoading={busy} onClick={() => review(proof.id, "reject", { reason })}>
                            Confirmar rechazo
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setRejecting(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-x-2">
                        <Button size="small" isLoading={busy} onClick={() => review(proof.id, "accept")}>
                          Aceptar
                        </Button>
                        <Button size="small" variant="secondary" onClick={() => setRejecting(proof.id)}>
                          Rechazar
                        </Button>
                      </div>
                    )
                  ) : (
                    <Badge color={proof.status === "accepted" ? "green" : "red"}>
                      {proof.status === "accepted" ? "Aceptado" : "Rechazado"}
                    </Badge>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Comprobantes" })

export default ProofsPage
