import {
  DEFAULT_SETTINGS,
  mergeSettings,
  validateSettingsPatch,
} from "../validation"

const CBU = "0123456789012345678901"

const valid = (patch: unknown) => validateSettingsPatch(patch)

describe("validateSettingsPatch", () => {
  it("acepta un parche completo y válido", () => {
    const result = valid({
      bank_account: {
        holder: "Comercio SRL",
        cbu: CBU,
        alias: "comercio.aloe",
        bank: "Banco Ejemplo",
      },
      transfer_reservation_hours: 24,
      max_units_per_variant: 5,
      admin_notification_email: "dueno@comercio.com",
      transfer_promotion_code: "k3J9x2Qv7LmP4aRt8WzB",
    })
    expect(result.ok).toBe(true)
  })

  it("acepta un parche parcial y uno vacío", () => {
    expect(valid({ max_units_per_variant: 10 }).ok).toBe(true)
    expect(valid({}).ok).toBe(true)
  })

  it("rechaza un CBU o CVU que no tiene 22 dígitos", () => {
    for (const cbu of ["123", CBU + "1", "01234567890123456789ab", ""]) {
      const result = valid({
        bank_account: { holder: "A", cbu, alias: "alias.ok", bank: "B" },
      })
      expect(result).toMatchObject({
        ok: false,
        errors: [{ field: "bank_account.cbu" }],
      })
    }
  })

  it("valida el alias: de 6 a 20 caracteres con letras, números, puntos o guiones", () => {
    const withAlias = (alias: string) =>
      valid({ bank_account: { holder: "A", cbu: CBU, alias, bank: "B" } })
    expect(withAlias("abcdef").ok).toBe(true)
    expect(withAlias("a".repeat(20)).ok).toBe(true)
    expect(withAlias("mi-alias.123").ok).toBe(true)
    for (const bad of ["abcde", "a".repeat(21), "con espacio", "ñandú.mp", "a@b.com.ar"]) {
      expect(withAlias(bad)).toMatchObject({
        ok: false,
        errors: [{ field: "bank_account.alias" }],
      })
    }
  })

  it("exige titular y banco", () => {
    const result = valid({
      bank_account: { holder: " ", cbu: CBU, alias: "alias.ok", bank: "" },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.map((e) => e.field).sort()).toEqual([
        "bank_account.bank",
        "bank_account.holder",
      ])
    }
  })

  it("las horas de reserva son un entero entre 1 y 72", () => {
    expect(valid({ transfer_reservation_hours: 1 }).ok).toBe(true)
    expect(valid({ transfer_reservation_hours: 72 }).ok).toBe(true)
    for (const bad of [0, 73, 1.5, "24", null, NaN, -1]) {
      expect(valid({ transfer_reservation_hours: bad })).toMatchObject({
        ok: false,
        errors: [{ field: "transfer_reservation_hours" }],
      })
    }
  })

  it("las unidades por variante son un entero entre 1 y 50", () => {
    expect(valid({ max_units_per_variant: 1 }).ok).toBe(true)
    expect(valid({ max_units_per_variant: 50 }).ok).toBe(true)
    for (const bad of [0, 51, 2.2, "5"]) {
      expect(valid({ max_units_per_variant: bad })).toMatchObject({
        ok: false,
        errors: [{ field: "max_units_per_variant" }],
      })
    }
  })

  it("valida el email de avisos", () => {
    expect(valid({ admin_notification_email: "a@b.co" }).ok).toBe(true)
    for (const bad of ["sin-arroba", "a@b", "a b@c.com", ""]) {
      expect(valid({ admin_notification_email: bad })).toMatchObject({
        ok: false,
        errors: [{ field: "admin_notification_email" }],
      })
    }
  })

  it("el código de la promoción debe ser largo y sin símbolos raros", () => {
    expect(valid({ transfer_promotion_code: "k3J9x2Qv7LmP4aRt8WzB" }).ok).toBe(true)
    for (const bad of ["corto", "con espacios en el medio!!", "a".repeat(129)]) {
      expect(valid({ transfer_promotion_code: bad })).toMatchObject({
        ok: false,
        errors: [{ field: "transfer_promotion_code" }],
      })
    }
  })

  it("rechaza claves desconocidas, para no guardar cualquier cosa en la metadata", () => {
    expect(valid({ role: "superadmin" })).toMatchObject({
      ok: false,
      errors: [{ field: "role" }],
    })
    expect(valid({ max_units_per_variant: 5, otra: 1 }).ok).toBe(false)
  })

  it("rechaza lo que no es un objeto", () => {
    for (const bad of [null, undefined, "x", 5, [], true]) {
      expect(valid(bad).ok).toBe(false)
    }
  })

  it("junta todos los errores en una sola respuesta", () => {
    const result = valid({
      transfer_reservation_hours: 0,
      max_units_per_variant: 99,
      admin_notification_email: "x",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(3)
    }
  })

  it("no devuelve el valor ingresado en el mensaje de error (puede ser un CBU)", () => {
    const result = valid({
      bank_account: { holder: "A", cbu: "99999", alias: "alias.ok", bank: "B" },
    })
    expect(JSON.stringify(result)).not.toContain("99999")
  })
})

describe("mergeSettings", () => {
  it("completa con los valores por defecto cuando la metadata está vacía", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toMatchObject({
      transfer_reservation_hours: 24,
      max_units_per_variant: 5,
    })
  })

  it("respeta lo guardado e ignora las claves que no son de la configuración", () => {
    const merged = mergeSettings({
      max_units_per_variant: 8,
      otra_cosa: "no",
      role: "superadmin",
    })
    expect(merged.max_units_per_variant).toBe(8)
    expect(merged).not.toHaveProperty("otra_cosa")
    expect(merged).not.toHaveProperty("role")
  })
})
