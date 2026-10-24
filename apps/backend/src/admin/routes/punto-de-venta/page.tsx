import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, Toaster, toast } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { buildReceiptHtml, paymentLabel, type ReceiptSale } from "../../lib/receipt"

type Variant = { id: string; title: string; sku: string | null; price: number | null; available: number | null; in_stock: boolean }
type Product = { id: string; title: string; variants: Variant[] }
type Line = { variantId: string; label: string; price: number; quantity: number; available: number | null }
type Method = "cash" | "transfer" | "card"

const METHODS: Method[] = ["cash", "transfer", "card"]
const money = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: response.ok, json: await response.json().catch(() => ({})) as Record<string, any> }
}

function errorText(json: Record<string, any>): string {
  switch (json.code) {
    case "STOCK_INSUFFICIENT": {
      let available: number | null = null
      try {
        available = JSON.parse(json.message).available
      } catch {
        // mensaje sin detalle
      }
      return available === null ? "No hay stock suficiente." : `Solo quedan ${available} unidades.`
    }
    case "VARIANT_UNAVAILABLE":
      return "Ese producto ya no está disponible."
    case "SALE_ITEMS_EMPTY":
      return "Agregá al menos un producto a la venta."
    case "ROLE_NOT_ALLOWED":
      return "Tu rol no permite registrar ventas."
    default:
      return typeof json.message === "string" && json.type === "invalid_data" ? json.message : "No se pudo registrar la venta."
  }
}

/**
 * Punto de venta (planning.md, HU-34 a HU-36). Pensado para tablet y teclado:
 * controles grandes, búsqueda enfocada y todo alcanzable con Tab. El total que se
 * ve es una estimación; el definitivo lo calcula Medusa al registrar.
 */
const PosPage = () => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [searched, setSearched] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [method, setMethod] = useState<Method>("cash")
  const [customerName, setCustomerName] = useState("")
  const [customerDocument, setCustomerDocument] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [sale, setSale] = useState<ReceiptSale | null>(null)
  const [shopName, setShopName] = useState("Comercio")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void call("/admin/stores", "GET").then(({ ok, json }) => {
      if (ok && json.stores?.[0]?.name) setShopName(json.stores[0].name)
    })
  }, [])

  useEffect(() => {
    const text = query.trim()
    if (!text) {
      setResults([])
      setSearched(false)
      return
    }
    const timer = setTimeout(async () => {
      const { ok, json } = await call(`/admin/pos/products?q=${encodeURIComponent(text)}`, "GET")
      setResults(ok ? json.products : [])
      setSearched(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const add = (product: Product, variant: Variant) => {
    if (!variant.in_stock || variant.price === null) return
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variant.id)
      if (existing) {
        if (existing.available !== null && existing.quantity >= existing.available) {
          toast.error(`Solo quedan ${existing.available} unidades.`)
          return current
        }
        return current.map((line) => (line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [
        ...current,
        { variantId: variant.id, label: `${product.title} · ${variant.title}`, price: variant.price as number, quantity: 1, available: variant.available },
      ]
    })
  }

  const change = (variantId: string, delta: number) =>
    setLines((current) =>
      current.flatMap((line) => {
        if (line.variantId !== variantId) return [line]
        const quantity = line.quantity + delta
        if (quantity < 1) return []
        if (line.available !== null && quantity > line.available) {
          toast.error(`Solo quedan ${line.available} unidades.`)
          return [line]
        }
        return [{ ...line, quantity }]
      })
    )

  const estimated = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)

  const register = async () => {
    setBusy(true)
    const { ok, json } = await call("/admin/pos/sales", "POST", {
      items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      payment_method: method,
      customer: { name: customerName, document: customerDocument },
      note,
    })
    setBusy(false)
    if (!ok) return toast.error(errorText(json))
    setSale(json.sale)
    toast.success(`Venta #${json.sale.display_id} registrada.`)
  }

  const reset = () => {
    setSale(null)
    setLines([])
    setQuery("")
    setResults([])
    setCustomerName("")
    setCustomerDocument("")
    setNote("")
    setMethod("cash")
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  const print = () => {
    if (!sale) return
    const popup = window.open("", "_blank", "width=420,height=640")
    if (!popup) return toast.error("El navegador bloqueó la ventana de impresión.")
    popup.document.open()
    popup.document.write(buildReceiptHtml(sale, shopName))
    popup.document.close()
    popup.focus()
    popup.print()
  }

  if (sale) {
    return (
      <Container className="flex flex-col gap-y-6 p-6">
        <Toaster />
        <div>
          <Heading level="h1">Venta #{sale.display_id} registrada</Heading>
          <Text className="text-ui-fg-subtle">
            {money(sale.total)} · {paymentLabel(sale.payment_method)}
          </Text>
        </div>
        <div className="flex gap-x-3">
          <Button size="large" onClick={print}>
            Imprimir comprobante
          </Button>
          <Button size="large" variant="secondary" onClick={reset} autoFocus>
            Nueva venta
          </Button>
        </div>
      </Container>
    )
  }

  return (
    <Container className="flex flex-col gap-y-6 p-6">
      <Toaster />
      <div>
        <Heading level="h1">Punto de venta</Heading>
        <Text className="text-ui-fg-subtle">Buscá por nombre o SKU, armá la venta y cobrá.</Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Buscar productos" className="flex flex-col gap-y-3">
          <Label htmlFor="pos-search">Buscar producto o SKU</Label>
          <Input id="pos-search" ref={searchRef} autoFocus size="base" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: pijama o PIJ-M" />
          {searched && results.length === 0 && <Text className="text-ui-fg-subtle">No encontramos productos con ese nombre o SKU.</Text>}
          <ul className="flex flex-col gap-y-3">
            {results.map((product) => (
              <li key={product.id} className="rounded-lg border border-ui-border-base p-3">
                <Text weight="plus">{product.title}</Text>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <li key={variant.id}>
                      <Button
                        size="large"
                        variant="secondary"
                        disabled={!variant.in_stock || variant.price === null}
                        onClick={() => add(product, variant)}
                      >
                        {variant.title}
                        {variant.price !== null && ` · ${money(variant.price)}`}
                        {variant.in_stock ? (variant.available !== null ? ` · ${variant.available} u.` : "") : " · sin stock"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Venta" className="flex flex-col gap-y-4">
          <Heading level="h2">Venta</Heading>
          {lines.length === 0 ? (
            <Text className="text-ui-fg-subtle">Todavía no agregaste productos.</Text>
          ) : (
            <ul className="flex flex-col gap-y-2">
              {lines.map((line) => (
                <li key={line.variantId} className="flex items-center justify-between gap-x-3 rounded-lg border border-ui-border-base p-3">
                  <div className="flex flex-col">
                    <Text weight="plus">{line.label}</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {money(line.price)} c/u
                    </Text>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <Button size="large" variant="secondary" aria-label={`Quitar una unidad de ${line.label}`} onClick={() => change(line.variantId, -1)}>
                      −
                    </Button>
                    <Badge size="large">{line.quantity}</Badge>
                    <Button size="large" variant="secondary" aria-label={`Agregar una unidad de ${line.label}`} onClick={() => change(line.variantId, 1)}>
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between border-t border-ui-border-base pt-3">
            <Text weight="plus">Total estimado</Text>
            <Text weight="plus">{money(estimated)}</Text>
          </div>

          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-2 text-ui-fg-subtle">Medio de pago</legend>
            {METHODS.map((item) => (
              <Button key={item} size="large" variant={method === item ? "primary" : "secondary"} aria-pressed={method === item} onClick={() => setMethod(item)}>
                {paymentLabel(item)}
              </Button>
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="pos-name">Cliente (opcional)</Label>
              <Input id="pos-name" value={customerName} maxLength={100} onChange={(event) => setCustomerName(event.target.value)} />
            </div>
            <div className="flex flex-col gap-y-1">
              <Label htmlFor="pos-doc">Documento (opcional)</Label>
              <Input id="pos-doc" value={customerDocument} inputMode="numeric" onChange={(event) => setCustomerDocument(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-y-1">
            <Label htmlFor="pos-note">Nota (opcional)</Label>
            <Textarea id="pos-note" value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} />
          </div>

          <Button size="large" disabled={lines.length === 0} isLoading={busy} onClick={register}>
            Registrar venta
          </Button>
        </section>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Punto de venta" })

export default PosPage
