import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Input, Label, Table, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { paymentLabel } from "../../lib/receipt"

type Summary = {
  totals: Record<"cash" | "transfer" | "card", number>
  total: number
  count: number
  sales: { display_id: number; total: number; payment_method: string; created_at: string; user: string | null }[]
}

const money = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

// Hoy en hora de Argentina (UTC-3), en formato AAAA-MM-DD.
const today = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

/** Cierre de caja: ventas del local por día y medio de pago (planning.md, HU-37). Solo admin. */
const DailySalesPage = () => {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    void fetch(`/admin/pos/sales?date=${date}`, { credentials: "include" }).then(async (response) => {
      const json = await response.json().catch(() => ({}))
      if (response.ok) setData(json)
      else setError(json.code === "ROLE_NOT_ALLOWED" ? "Tu rol no permite ver las ventas del día." : "No se pudieron cargar las ventas.")
    })
  }, [date])

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      <div>
        <Heading level="h1">Ventas del día</Heading>
        <Text className="text-ui-fg-subtle">Solo ventas registradas en el local.</Text>
      </div>

      <div className="flex max-w-xs flex-col gap-y-1">
        <Label htmlFor="day">Fecha</Label>
        <Input id="day" type="date" value={date} max={today()} onChange={(event) => event.target.value && setDate(event.target.value)} />
      </div>

      {error && <Text className="text-ui-fg-error">{error}</Text>}
      {!error && data === null && <Text>Cargando…</Text>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {(["cash", "transfer", "card"] as const).map((method) => (
              <div key={method} className="rounded-lg border border-ui-border-base p-4">
                <Text size="small" className="text-ui-fg-subtle">
                  {paymentLabel(method)}
                </Text>
                <Heading level="h2">{money(data.totals[method])}</Heading>
              </div>
            ))}
            <div className="rounded-lg border border-ui-border-strong p-4">
              <Text size="small" className="text-ui-fg-subtle">
                Total ({data.count} ventas)
              </Text>
              <Heading level="h2">{money(data.total)}</Heading>
            </div>
          </div>

          {data.sales.length === 0 ? (
            <Text className="text-ui-fg-subtle">No hubo ventas en el local ese día.</Text>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Venta</Table.HeaderCell>
                  <Table.HeaderCell>Hora</Table.HeaderCell>
                  <Table.HeaderCell>Medio</Table.HeaderCell>
                  <Table.HeaderCell>Usuario</Table.HeaderCell>
                  <Table.HeaderCell>Total</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.sales.map((sale) => (
                  <Table.Row key={sale.display_id}>
                    <Table.Cell>#{sale.display_id}</Table.Cell>
                    <Table.Cell>
                      {new Date(sale.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
                    </Table.Cell>
                    <Table.Cell>{paymentLabel(sale.payment_method)}</Table.Cell>
                    <Table.Cell>{sale.user ?? "—"}</Table.Cell>
                    <Table.Cell>{money(sale.total)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Ventas del día" })

export default DailySalesPage
