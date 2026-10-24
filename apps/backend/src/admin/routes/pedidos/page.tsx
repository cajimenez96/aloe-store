import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Label, Select, Table, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { ORDERS_PAGE_SIZE, PAYMENT_GROUPS, buildOrdersQuery, paymentGroupOf } from "../../lib/orders-filter"

type Order = {
  id: string
  display_id: number
  created_at: string
  email: string | null
  total: number
  currency_code: string
  payment_status: string
  status: string
  sales_channel?: { name: string } | null
}
type Channel = { id: string; name: string }

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: currency.toUpperCase() }).format(amount)

const get = async (path: string) => {
  const response = await fetch(path, { credentials: "include" })
  return { ok: response.ok, json: (await response.json().catch(() => ({}))) as Record<string, any> }
}

/**
 * Pedidos con filtro por canal y por estado de pago, que el listado nativo de
 * Medusa 2.22 no tiene (planning.md, HU-32). El detalle de cada pedido es el nativo.
 */
const OrdersPage = () => {
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState("")
  const [group, setGroup] = useState("")
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<{ orders: Order[]; count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void get("/admin/sales-channels").then(({ ok, json }) => ok && setChannels(json.sales_channels))
  }, [])

  useEffect(() => {
    // Si cambia un filtro mientras llega una respuesta anterior, esa respuesta se descarta.
    let current = true
    setData(null)
    setError(null)
    void get(`/admin/order-list?${buildOrdersQuery({ channelId, group, offset })}`).then(({ ok, json }) => {
      if (!current) return
      if (ok) setData({ orders: json.orders, count: json.count })
      else setError("No se pudieron cargar los pedidos.")
    })
    return () => {
      current = false
    }
  }, [channelId, group, offset])

  const reset = (apply: () => void) => {
    setOffset(0)
    apply()
  }

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      <div>
        <Heading level="h1">Pedidos</Heading>
        <Text className="text-ui-fg-subtle">Filtrá por canal y por estado de pago. Abrí un pedido para ver todo el detalle.</Text>
      </div>

      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="orders-channel">Canal</Label>
          <Select value={channelId || "all"} onValueChange={(value) => reset(() => setChannelId(value === "all" ? "" : value))}>
            <Select.Trigger id="orders-channel">
              <Select.Value placeholder="Todos" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Todos</Select.Item>
              {channels.map((channel) => (
                <Select.Item key={channel.id} value={channel.id}>
                  {channel.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-y-1">
          <Label htmlFor="orders-payment">Estado de pago</Label>
          <Select value={group || "all"} onValueChange={(value) => reset(() => setGroup(value === "all" ? "" : value))}>
            <Select.Trigger id="orders-payment">
              <Select.Value placeholder="Todos" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">Todos</Select.Item>
              {Object.entries(PAYMENT_GROUPS).map(([key, item]) => (
                <Select.Item key={key} value={key}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
      </div>

      {error && <Text className="text-ui-fg-error">{error}</Text>}
      {!error && data === null && <Text>Cargando…</Text>}

      {data && (data.orders.length === 0 ? (
        <Text className="text-ui-fg-subtle">No hay pedidos con esos filtros.</Text>
      ) : (
        <>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Pedido</Table.HeaderCell>
                <Table.HeaderCell>Fecha</Table.HeaderCell>
                <Table.HeaderCell>Canal</Table.HeaderCell>
                <Table.HeaderCell>Cliente</Table.HeaderCell>
                <Table.HeaderCell>Pago</Table.HeaderCell>
                <Table.HeaderCell>Total</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.orders.map((order) => (
                <Table.Row key={order.id}>
                  <Table.Cell>
                    <a href={`/app/orders/${order.id}`} className="text-ui-fg-interactive underline">
                      #{order.display_id}
                    </a>
                  </Table.Cell>
                  <Table.Cell>{new Date(order.created_at).toLocaleString("es-AR")}</Table.Cell>
                  <Table.Cell>{order.sales_channel?.name ?? "—"}</Table.Cell>
                  <Table.Cell>{order.email ?? "—"}</Table.Cell>
                  <Table.Cell>
                    <Badge color={(PAYMENT_GROUPS.paid.statuses as readonly string[]).includes(order.payment_status) ? "green" : "orange"}>
                      {paymentGroupOf(order.payment_status)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>{money(Number(order.total), order.currency_code)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <div className="flex items-center justify-between">
            <Text size="small" className="text-ui-fg-subtle">
              {offset + 1}–{Math.min(offset + ORDERS_PAGE_SIZE, data.count)} de {data.count}
            </Text>
            <div className="flex gap-x-2">
              <Button size="small" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - ORDERS_PAGE_SIZE))}>
                Anterior
              </Button>
              <Button size="small" variant="secondary" disabled={offset + ORDERS_PAGE_SIZE >= data.count} onClick={() => setOffset(offset + ORDERS_PAGE_SIZE)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      ))}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Pedidos" })

export default OrdersPage
