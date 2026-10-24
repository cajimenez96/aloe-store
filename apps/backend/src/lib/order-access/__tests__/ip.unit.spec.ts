import { clientIp } from "../ip"

describe("clientIp (SEC-40)", () => {
  it("por defecto usa la dirección real de la conexión e ignora X-Forwarded-For", () => {
    expect(clientIp({ remoteAddress: "10.0.0.5", forwardedFor: "9.9.9.9", trustedHops: 0 })).toBe("10.0.0.5")
  })

  it("con un proxy de confianza toma la IP que ese proxy agregó al final", () => {
    expect(clientIp({ remoteAddress: "10.0.0.1", forwardedFor: "1.1.1.1, 203.0.113.9", trustedHops: 1 })).toBe(
      "203.0.113.9"
    )
  })

  it("con dos proxies de confianza toma la penúltima entrada", () => {
    expect(
      clientIp({ remoteAddress: "10.0.0.1", forwardedFor: "1.1.1.1, 203.0.113.9, 10.0.0.2", trustedHops: 2 })
    ).toBe("203.0.113.9")
  })

  it("una entrada inventada por el cliente al principio no cambia el resultado", () => {
    const a = clientIp({ remoteAddress: "10.0.0.1", forwardedFor: "203.0.113.9", trustedHops: 1 })
    const b = clientIp({ remoteAddress: "10.0.0.1", forwardedFor: "6.6.6.6, 203.0.113.9", trustedHops: 1 })
    expect(a).toBe(b)
  })

  it("si faltan entradas cae a la dirección de la conexión", () => {
    expect(clientIp({ remoteAddress: "10.0.0.1", forwardedFor: undefined, trustedHops: 1 })).toBe("10.0.0.1")
    expect(clientIp({ remoteAddress: "10.0.0.1", forwardedFor: "1.1.1.1", trustedHops: 3 })).toBe("10.0.0.1")
  })

  it("una entrada que no parece una IP no se usa como clave (cae a la conexión)", () => {
    for (const forged of ['evil"\n', "<script>", "a".repeat(200), "1.2.3.4; drop", ""]) {
      expect(clientIp({ remoteAddress: "10.0.0.5", forwardedFor: forged, trustedHops: 1 })).toBe("10.0.0.5")
    }
  })

  it("sin nada devuelve undefined", () => {
    expect(clientIp({ remoteAddress: undefined, forwardedFor: undefined, trustedHops: 0 })).toBeUndefined()
  })
})
