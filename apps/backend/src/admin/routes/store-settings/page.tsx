import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, Toaster, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type FieldError = { field: string; message: string }

type Form = {
  holder: string
  cbu: string
  alias: string
  bank: string
  hours: string
  units: string
  email: string
  promoCode: string
}

const EMPTY: Form = {
  holder: "",
  cbu: "",
  alias: "",
  bank: "",
  hours: "24",
  units: "5",
  email: "",
  promoCode: "",
}

async function request(method: "GET" | "PATCH", body?: unknown) {
  const response = await fetch("/admin/store-settings", {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, json }
}

const toForm = (settings: Record<string, any>): Form => ({
  holder: settings.bank_account?.holder ?? "",
  cbu: settings.bank_account?.cbu ?? "",
  alias: settings.bank_account?.alias ?? "",
  bank: settings.bank_account?.bank ?? "",
  hours: String(settings.transfer_reservation_hours ?? 24),
  units: String(settings.max_units_per_variant ?? 5),
  email: settings.admin_notification_email ?? "",
  promoCode: settings.transfer_promotion_code ?? "",
})

const StoreSettingsPage = () => {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    request("GET").then(({ ok, json }) => {
      if (ok) {
        setForm(toForm(json.settings))
      } else {
        toast.error("No se pudo cargar la configuración.")
      }
      setLoading(false)
    })
  }, [])

  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = async () => {
    setSaving(true)
    setErrors({})
    const payload: Record<string, unknown> = {
      transfer_reservation_hours: Number(form.hours),
      max_units_per_variant: Number(form.units),
    }
    if (form.holder || form.cbu || form.alias || form.bank) {
      payload.bank_account = {
        holder: form.holder,
        cbu: form.cbu,
        alias: form.alias,
        bank: form.bank,
      }
    }
    if (form.email) payload.admin_notification_email = form.email
    if (form.promoCode) payload.transfer_promotion_code = form.promoCode

    const { ok, json } = await request("PATCH", payload)
    if (ok) {
      setForm(toForm(json.settings))
      toast.success("Configuración guardada.")
    } else if (json.code === "SETTING_INVALID") {
      const byField: Record<string, string> = {}
      for (const error of json.details.fields as FieldError[]) {
        byField[error.field] = error.message
      }
      setErrors(byField)
      toast.error("Corregí los campos marcados.")
    } else {
      toast.error("No se pudo guardar. Probá de nuevo.")
    }
    setSaving(false)
  }

  const field = (
    key: keyof Form,
    label: string,
    errorKey: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <div className="flex flex-col gap-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} value={form[key]} onChange={set(key)} aria-invalid={!!errors[errorKey]} {...props} />
      {errors[errorKey] && (
        <Text size="small" className="text-ui-fg-error">
          {errors[errorKey]}
        </Text>
      )}
    </div>
  )

  return (
    <Container className="flex flex-col gap-y-8 p-6">
      <Toaster />
      <div>
        <Heading level="h1">Datos del comercio</Heading>
        <Text className="text-ui-fg-subtle">
          Los datos bancarios se muestran al cliente que paga por transferencia.
        </Text>
      </div>

      <div className="flex flex-col gap-y-4">
        <Heading level="h2">Cuenta bancaria</Heading>
        {field("holder", "Titular", "bank_account.holder", { disabled: loading })}
        {field("cbu", "CBU o CVU (22 dígitos)", "bank_account.cbu", { disabled: loading, inputMode: "numeric" })}
        {field("alias", "Alias", "bank_account.alias", { disabled: loading })}
        {field("bank", "Banco", "bank_account.bank", { disabled: loading })}
      </div>

      <div className="flex flex-col gap-y-4">
        <Heading level="h2">Pedidos por transferencia</Heading>
        {field("hours", "Horas de reserva sin comprobante (1 a 72)", "transfer_reservation_hours", { disabled: loading, inputMode: "numeric" })}
        {field("units", "Unidades máximas por variante en un pedido (1 a 50)", "max_units_per_variant", { disabled: loading, inputMode: "numeric" })}
        {field("email", "Email que recibe los avisos de comprobantes", "admin_notification_email", { disabled: loading, type: "email" })}
        {field("promoCode", "Código interno de la promoción de transferencia", "transfer_promotion_code", { disabled: loading, autoComplete: "off" })}
        <Text size="small" className="text-ui-fg-subtle">
          Es el código de la promoción de transferencia creada en Promociones. El cliente nunca lo ve.
        </Text>
      </div>

      <div>
        <Button onClick={save} isLoading={saving} disabled={loading}>
          Guardar
        </Button>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Datos del comercio",
})

export default StoreSettingsPage
