import { assertStrongSecrets } from "../secrets"

const strong = "k3J9x2Qv7LmP4aRt8WzB5nYc1HdF6sGu"

describe("assertStrongSecrets (SEC-10)", () => {
  it("en producción acepta secretos largos y propios", () => {
    expect(() => assertStrongSecrets({ NODE_ENV: "production", JWT_SECRET: strong, COOKIE_SECRET: strong + "x" })).not.toThrow()
  })

  it("en producción rechaza secretos faltantes", () => {
    expect(() => assertStrongSecrets({ NODE_ENV: "production", COOKIE_SECRET: strong })).toThrow(/JWT_SECRET/)
    expect(() => assertStrongSecrets({ NODE_ENV: "production", JWT_SECRET: strong })).toThrow(/COOKIE_SECRET/)
  })

  it("en producción rechaza los valores de ejemplo y los cortos", () => {
    for (const weak of ["supersecret", "changeme", "secret", "password", "test", "x".repeat(31), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]) {
      expect(() => assertStrongSecrets({ NODE_ENV: "production", JWT_SECRET: weak, COOKIE_SECRET: strong })).toThrow(/JWT_SECRET/)
    }
  })

  it("el mensaje no repite el valor del secreto", () => {
    try {
      assertStrongSecrets({ NODE_ENV: "production", JWT_SECRET: "supersecret", COOKIE_SECRET: strong })
    } catch (error) {
      expect(String(error)).not.toContain("supersecret")
    }
  })

  it("en desarrollo no bloquea (el starter usa supersecret)", () => {
    expect(() => assertStrongSecrets({ NODE_ENV: "development", JWT_SECRET: "supersecret", COOKIE_SECRET: "supersecret" })).not.toThrow()
    expect(() => assertStrongSecrets({})).not.toThrow()
  })
})
