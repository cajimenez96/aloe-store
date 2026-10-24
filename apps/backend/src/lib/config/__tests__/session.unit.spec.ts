import { sessionCookieOptions } from "../session"

describe("sessionCookieOptions (SEC-23)", () => {
  it("por defecto no cambia nada: rige el comportamiento seguro de Medusa", () => {
    expect(sessionCookieOptions({})).toBeUndefined()
    expect(sessionCookieOptions({ INSECURE_SESSION_COOKIE: "false", MEDUSA_BACKEND_URL: "https://api.aloe.com" })).toBeUndefined()
  })

  it("permite cookie sin Secure solo con la variable explícita y un backend http local", () => {
    expect(sessionCookieOptions({ INSECURE_SESSION_COOKIE: "true", MEDUSA_BACKEND_URL: "http://localhost:9300" })).toEqual({
      secure: false,
    })
  })

  it("se niega a activarse con un backend https (sería un despliegue)", () => {
    expect(() => sessionCookieOptions({ INSECURE_SESSION_COOKIE: "true", MEDUSA_BACKEND_URL: "https://api.aloe.com" })).toThrow(
      /INSECURE_SESSION_COOKIE/
    )
  })

  it("se niega a activarse en un host que no es local", () => {
    expect(() => sessionCookieOptions({ INSECURE_SESSION_COOKIE: "true", MEDUSA_BACKEND_URL: "http://tienda.aloe.com" })).toThrow()
  })

  it("sin MEDUSA_BACKEND_URL tampoco se activa", () => {
    expect(() => sessionCookieOptions({ INSECURE_SESSION_COOKIE: "true" })).toThrow()
  })
})
