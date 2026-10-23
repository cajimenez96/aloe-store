"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { saveCheckout } from "@/lib/checkout/actions"
import type { ShippingChoice } from "@/lib/checkout/api"
import type { CheckoutField } from "@/lib/checkout/schema"
import { INITIAL_CHECKOUT_STATE } from "@/lib/checkout/state"
import { formatPrice } from "@/lib/price"

type Initial = Partial<Record<CheckoutField, string>>

type CheckoutFormProps = {
  choices: ShippingChoice[]
  currencyCode: string
  /** Datos ya guardados en el carrito, para recuperarlos al volver. */
  initial: Initial
}

function Field({
  name,
  label,
  error,
  defaultValue,
  type = "text",
  optional = false,
  autoComplete,
  inputMode,
}: {
  name: CheckoutField
  label: string
  error?: string
  defaultValue?: string
  type?: string
  optional?: boolean
  autoComplete?: string
  inputMode?: "numeric" | "tel" | "email" | "text"
}) {
  const errorId = `${name}-error`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm">
        {label}
        {optional && <span className="text-shade-60"> (opcional)</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="min-h-11 rounded-md border border-hairline bg-canvas-light px-4 py-2 text-base"
      />
      <p id={errorId} role={error ? "alert" : undefined} className="min-h-5 text-sm">
        {error}
      </p>
    </div>
  )
}

/**
 * Datos del invitado y forma de entrega. Sin contraseña ni cuenta (HU-19). La
 * dirección solo aparece si se elige un envío (HU-20). Si hay errores, los
 * valores cargados se conservan.
 */
export function CheckoutForm({ choices, currencyCode, initial }: CheckoutFormProps) {
  const [state, formAction, pending] = useActionState(saveCheckout, INITIAL_CHECKOUT_STATE)
  const values: Initial = { ...initial, ...state.values }
  const [selected, setSelected] = useState(values.shippingOptionId ?? "")
  const kind = choices.find((c) => c.id === selected)?.kind

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-2xl">Tus datos</legend>
        <Field name="name" label="Nombre y apellido" defaultValue={values.name} error={state.errors.name} autoComplete="name" />
        <Field name="email" label="Email" type="email" defaultValue={values.email} error={state.errors.email} autoComplete="email" inputMode="email" />
        <Field name="phone" label="Teléfono" type="tel" defaultValue={values.phone} error={state.errors.phone} autoComplete="tel" inputMode="tel" />
        <Field name="document" label="Documento" optional defaultValue={values.document} error={state.errors.document} inputMode="numeric" />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-2xl">Entrega</legend>
        {choices.length === 0 && <p>No hay opciones de entrega disponibles por ahora.</p>}
        {choices.map((choice) => (
          <label
            key={choice.id}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-md border border-hairline px-4 py-3 has-[:checked]:border-ink"
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="shippingOptionId"
                value={choice.id}
                defaultChecked={values.shippingOptionId === choice.id}
                onChange={() => setSelected(choice.id)}
                aria-describedby={state.errors.shippingOptionId ? "shippingOptionId-error" : undefined}
              />
              {choice.name}
            </span>
            <span className="text-shade-60">
              {choice.amount > 0 ? formatPrice(choice.amount, currencyCode) : "Sin costo"}
            </span>
          </label>
        ))}
        <p id="shippingOptionId-error" role={state.errors.shippingOptionId ? "alert" : undefined} className="text-sm">
          {state.errors.shippingOptionId}
        </p>

        {kind === "delivery" && (
          <div className="flex flex-col gap-2 pt-2">
            <Field name="street" label="Calle y número" defaultValue={values.street} error={state.errors.street} autoComplete="address-line1" />
            <Field name="city" label="Ciudad" defaultValue={values.city} error={state.errors.city} autoComplete="address-level2" />
            <Field name="province" label="Provincia" defaultValue={values.province} error={state.errors.province} autoComplete="address-level1" />
            <Field name="postalCode" label="Código postal" defaultValue={values.postalCode} error={state.errors.postalCode} autoComplete="postal-code" />
          </div>
        )}
      </fieldset>

      <div aria-live="polite" className="text-sm">
        {state.message && !state.saved && <p role="alert">{state.message}</p>}
        {state.saved && <p>Datos guardados.</p>}
      </div>

      <Button type="submit" disabled={pending || choices.length === 0} className="w-full md:w-auto">
        {pending ? "Guardando…" : "Guardar datos"}
      </Button>
    </form>
  )
}
