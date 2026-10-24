import { describe, expect, it } from "vitest"
import { forwardedIp } from "../client-ip"

describe("forwardedIp", () => {
  it("sin proxies de confianza no reenvía nada (en local el backend ve la conexión)", () => {
    expect(forwardedIp({ forwardedFor: "203.0.113.9", hops: 0 })).toBeUndefined()
  })

  it("con un proxy de confianza toma la IP que ese proxy agregó al final", () => {
    expect(forwardedIp({ forwardedFor: "6.6.6.6, 203.0.113.9", hops: 1 })).toBe("203.0.113.9")
  })

  it("lo que el cliente inventó al principio no cuenta", () => {
    expect(forwardedIp({ forwardedFor: "6.6.6.6, 7.7.7.7, 203.0.113.9", hops: 1 })).toBe("203.0.113.9")
    expect(forwardedIp({ forwardedFor: "6.6.6.6, 203.0.113.9, 10.0.0.2", hops: 2 })).toBe("203.0.113.9")
  })

  it("sin header o con menos entradas de las esperadas no reenvía nada", () => {
    expect(forwardedIp({ forwardedFor: undefined, hops: 1 })).toBeUndefined()
    expect(forwardedIp({ forwardedFor: "203.0.113.9", hops: 2 })).toBeUndefined()
  })

  it("descarta valores que no parecen una IP (no se reenvía basura al backend)", () => {
    expect(forwardedIp({ forwardedFor: "<script>", hops: 1 })).toBeUndefined()
    expect(forwardedIp({ forwardedFor: "1.2.3.4\r\nx-evil: 1", hops: 1 })).toBeUndefined()
  })
})
