/**
 * Configuración del comercio que edita el admin (arquitectura.md, secciones 6 y
 * 14.6). Se guarda en `store.metadata`; no hay una tabla propia.
 */
export type BankAccount = {
  holder: string
  cbu: string
  alias: string
  bank: string
}

export type StoreSettings = {
  bank_account?: BankAccount
  transfer_reservation_hours: number
  max_units_per_variant: number
  admin_notification_email?: string
  transfer_promotion_code?: string
}

export const SETTING_KEYS = [
  "bank_account",
  "transfer_reservation_hours",
  "max_units_per_variant",
  "admin_notification_email",
  "transfer_promotion_code",
] as const

export const DEFAULT_SETTINGS = {
  transfer_reservation_hours: 24,
  max_units_per_variant: 5,
} satisfies Partial<StoreSettings>

export type SettingError = { field: string; message: string }

export type ValidationResult =
  | { ok: true; value: Partial<StoreSettings> }
  | { ok: false; errors: SettingError[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isIntegerInRange = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max

const isNonEmptyText = (value: unknown, max = 100) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max

/**
 * Valida un parche parcial. Los mensajes nunca repiten el valor ingresado,
 * porque puede ser un CBU (seguridad.md, SEC-70).
 */
export function validateSettingsPatch(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Se esperaba un objeto con la configuración." }],
    }
  }

  const errors: SettingError[] = []
  const value: Partial<StoreSettings> = {}

  for (const key of Object.keys(input)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      errors.push({ field: key, message: "Este campo no es parte de la configuración." })
    }
  }

  if ("bank_account" in input) {
    const bank = input.bank_account
    if (!isRecord(bank)) {
      errors.push({ field: "bank_account", message: "Completá los datos bancarios." })
    } else {
      if (!isNonEmptyText(bank.holder)) {
        errors.push({ field: "bank_account.holder", message: "Ingresá el titular de la cuenta." })
      }
      if (typeof bank.cbu !== "string" || !/^\d{22}$/.test(bank.cbu)) {
        errors.push({ field: "bank_account.cbu", message: "El CBU o CVU tiene 22 dígitos." })
      }
      if (typeof bank.alias !== "string" || !/^[A-Za-z0-9.-]{6,20}$/.test(bank.alias)) {
        errors.push({
          field: "bank_account.alias",
          message: "El alias tiene de 6 a 20 caracteres: letras, números, puntos o guiones.",
        })
      }
      if (!isNonEmptyText(bank.bank)) {
        errors.push({ field: "bank_account.bank", message: "Ingresá el nombre del banco." })
      }
      if (!errors.some((e) => e.field.startsWith("bank_account"))) {
        value.bank_account = {
          holder: (bank.holder as string).trim(),
          cbu: bank.cbu as string,
          alias: bank.alias as string,
          bank: (bank.bank as string).trim(),
        }
      }
    }
  }

  if ("transfer_reservation_hours" in input) {
    if (isIntegerInRange(input.transfer_reservation_hours, 1, 72)) {
      value.transfer_reservation_hours = input.transfer_reservation_hours as number
    } else {
      errors.push({
        field: "transfer_reservation_hours",
        message: "Las horas de reserva son un número entero entre 1 y 72.",
      })
    }
  }

  if ("max_units_per_variant" in input) {
    if (isIntegerInRange(input.max_units_per_variant, 1, 50)) {
      value.max_units_per_variant = input.max_units_per_variant as number
    } else {
      errors.push({
        field: "max_units_per_variant",
        message: "Las unidades por variante son un número entero entre 1 y 50.",
      })
    }
  }

  if ("admin_notification_email" in input) {
    const email = input.admin_notification_email
    if (typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      value.admin_notification_email = email
    } else {
      errors.push({
        field: "admin_notification_email",
        message: "Ingresá un email válido.",
      })
    }
  }

  if ("transfer_promotion_code" in input) {
    const code = input.transfer_promotion_code
    if (typeof code === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(code)) {
      value.transfer_promotion_code = code
    } else {
      errors.push({
        field: "transfer_promotion_code",
        message: "El código tiene de 16 a 128 caracteres: letras, números, guiones o guiones bajos.",
      })
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value }
}

/** Devuelve la configuración con los valores por defecto, sin claves ajenas. */
export function mergeSettings(metadata: unknown): StoreSettings {
  const source = isRecord(metadata) ? metadata : {}
  const picked: Record<string, unknown> = {}
  for (const key of SETTING_KEYS) {
    if (source[key] !== undefined) {
      picked[key] = source[key]
    }
  }
  return { ...DEFAULT_SETTINGS, ...picked } as StoreSettings
}
