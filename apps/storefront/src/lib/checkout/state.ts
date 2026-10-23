import type { CheckoutField } from "./schema"

export type CheckoutState = {
  saved: boolean
  errors: Partial<Record<CheckoutField, string>>
  /** Lo que el cliente ya cargó, para no perderlo si hay que corregir algo. */
  values: Partial<Record<CheckoutField, string>>
  message: string | null
}

export const INITIAL_CHECKOUT_STATE: CheckoutState = { saved: false, errors: {}, values: {}, message: null }
