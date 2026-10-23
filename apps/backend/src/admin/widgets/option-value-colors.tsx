import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Input, Text, Toaster, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type ColorRow = { option_value_id: string; value: string; hex: string | null }

const NEUTRAL = "#CCCCCC"

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, json }
}

/** Asigna una muestra de color #RRGGBB a cada valor de la opción "Color" del producto. */
const OptionValueColors = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const [rows, setRows] = useState<ColorRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    api(`/admin/product-colors?product_id=${encodeURIComponent(data.id)}`).then(
      ({ ok, json }) => {
        if (!ok) {
          return
        }
        setRows(json.colors)
        setDrafts(
          Object.fromEntries(
            (json.colors as ColorRow[]).map((row) => [row.option_value_id, row.hex ?? ""])
          )
        )
      }
    )
  }, [data.id])

  if (!rows.length) {
    return null
  }

  const save = async (row: ColorRow) => {
    setSaving(row.option_value_id)
    setErrors((current) => ({ ...current, [row.option_value_id]: "" }))
    const { ok, json } = await api("/admin/product-colors", {
      method: "POST",
      body: JSON.stringify({
        option_value_id: row.option_value_id,
        hex: drafts[row.option_value_id],
      }),
    })
    if (ok) {
      const hex = json.product_color.hex as string
      setDrafts((current) => ({ ...current, [row.option_value_id]: hex }))
      setRows((current) =>
        current.map((r) => (r.option_value_id === row.option_value_id ? { ...r, hex } : r))
      )
      toast.success(`Color de "${row.value}" guardado.`)
    } else {
      setErrors((current) => ({
        ...current,
        [row.option_value_id]: json.message ?? "No se pudo guardar.",
      }))
    }
    setSaving(null)
  }

  return (
    <Container className="flex flex-col gap-y-4 p-6">
      <Toaster />
      <div>
        <Heading level="h2">Muestras de color</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Es el color que ve el cliente junto al nombre. Formato #RRGGBB. Un color sin
          muestra se ve con su nombre y un borde neutro.
        </Text>
      </div>
      {rows.map((row) => {
        const draft = drafts[row.option_value_id] ?? ""
        const preview = /^#[0-9A-Fa-f]{6}$/.test(draft) ? draft : NEUTRAL
        return (
          <div key={row.option_value_id} className="flex flex-col gap-y-1">
            <div className="flex items-center gap-x-3">
              <Text className="w-32 shrink-0">{row.value}</Text>
              <input
                type="color"
                aria-label={`Elegir color de ${row.value}`}
                value={preview}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.option_value_id]: event.target.value.toUpperCase(),
                  }))
                }
              />
              <Input
                className="w-32"
                aria-label={`Color de ${row.value} en formato #RRGGBB`}
                placeholder="#RRGGBB"
                value={draft}
                aria-invalid={!!errors[row.option_value_id]}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [row.option_value_id]: event.target.value,
                  }))
                }
              />
              <Button
                size="small"
                variant="secondary"
                isLoading={saving === row.option_value_id}
                onClick={() => save(row)}
              >
                Guardar
              </Button>
            </div>
            {errors[row.option_value_id] && (
              <Text size="small" className="text-ui-fg-error">
                {errors[row.option_value_id]}
              </Text>
            )}
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default OptionValueColors
