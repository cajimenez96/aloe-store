import { hashIp, pendingLimitReached } from "../limits"

const now = new Date("2026-10-24T12:00:00Z")
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000)
const order = (over: Record<string, unknown> = {}) => ({
  email: "ana@ejemplo.com",
  ipHash: "ip-a",
  status: "pending",
  createdAt: hoursAgo(1),
  ...over,
})

describe("pendingLimitReached (SEC-40)", () => {
  it("permite el primer y el segundo pedido de un email, rechaza el tercero", () => {
    expect(pendingLimitReached({ orders: [], email: "ana@ejemplo.com", ipHash: "x", now })).toBeNull()
    expect(pendingLimitReached({ orders: [order()], email: "ana@ejemplo.com", ipHash: "x", now })).toBeNull()
    expect(
      pendingLimitReached({ orders: [order(), order()], email: "ana@ejemplo.com", ipHash: "x", now })
    ).toBe("email")
  })

  it("el email se compara sin distinguir mayúsculas ni espacios", () => {
    expect(
      pendingLimitReached({
        orders: [order({ email: "Ana@Ejemplo.com " }), order()],
        email: "ANA@ejemplo.com",
        ipHash: "x",
        now,
      })
    ).toBe("email")
  })

  it("un alias con + cuenta como el mismo email", () => {
    expect(
      pendingLimitReached({
        orders: [order({ email: "ana+uno@ejemplo.com" }), order({ email: "ana+dos@ejemplo.com" })],
        email: "ana+tres@ejemplo.com",
        ipHash: "x",
        now,
      })
    ).toBe("email")
    expect(
      pendingLimitReached({ orders: [order(), order()], email: "ana+nuevo@ejemplo.com", ipHash: "x", now })
    ).toBe("email")
  })

  it("los pedidos ya pagados o cancelados no cuentan para el email", () => {
    expect(
      pendingLimitReached({
        orders: [order({ status: "completed" }), order({ status: "canceled" }), order()],
        email: "ana@ejemplo.com",
        ipHash: "x",
        now,
      })
    ).toBeNull()
  })

  it("rechaza el cuarto pedido pendiente de una misma IP en 24 horas", () => {
    const orders = [1, 2, 3].map((n) => order({ email: `c${n}@x.com`, ipHash: "ip-a" }))
    expect(pendingLimitReached({ orders, email: "nuevo@x.com", ipHash: "ip-a", now })).toBe("ip")
    expect(pendingLimitReached({ orders: orders.slice(0, 2), email: "nuevo@x.com", ipHash: "ip-a", now })).toBeNull()
  })

  it("los pedidos de la IP de más de 24 horas o de otra IP no cuentan", () => {
    const old = [1, 2, 3].map((n) => order({ email: `c${n}@x.com`, ipHash: "ip-a", createdAt: hoursAgo(25) }))
    expect(pendingLimitReached({ orders: old, email: "n@x.com", ipHash: "ip-a", now })).toBeNull()
    const other = [1, 2, 3].map((n) => order({ email: `c${n}@x.com`, ipHash: "ip-b" }))
    expect(pendingLimitReached({ orders: other, email: "n@x.com", ipHash: "ip-a", now })).toBeNull()
  })
})

describe("hashIp", () => {
  it("guarda un hash y no la IP (seguridad.md, SEC-70)", () => {
    const hashed = hashIp("203.0.113.9")
    expect(hashed).not.toContain("203.0.113.9")
    expect(hashed).toEqual(hashIp("203.0.113.9"))
    expect(hashed).not.toEqual(hashIp("203.0.113.10"))
  })

  it("sin IP devuelve un valor que no agrupa pedidos de distintos clientes", () => {
    expect(hashIp(undefined)).toBeNull()
  })
})
