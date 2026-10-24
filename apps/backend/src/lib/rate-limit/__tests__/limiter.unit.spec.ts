import { DEFAULT_LIMITS, RateLimiter, parseLimits } from "../limiter"

describe("RateLimiter (SEC-17)", () => {
  let now = 1_000_000
  const clock = () => now
  beforeEach(() => {
    now = 1_000_000
  })

  it("deja pasar hasta el límite y rechaza el siguiente, con el tiempo de espera", () => {
    const limiter = new RateLimiter(clock)
    for (let i = 0; i < 5; i++) {
      expect(limiter.hit("login", "ip-a", { limit: 5, windowSeconds: 60 }).allowed).toBe(true)
    }
    const blocked = limiter.hit("login", "ip-a", { limit: 5, windowSeconds: 60 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it("cada IP y cada ruta cuentan por separado", () => {
    const limiter = new RateLimiter(clock)
    const rule = { limit: 1, windowSeconds: 60 }
    expect(limiter.hit("login", "ip-a", rule).allowed).toBe(true)
    expect(limiter.hit("login", "ip-a", rule).allowed).toBe(false)
    expect(limiter.hit("login", "ip-b", rule).allowed).toBe(true)
    expect(limiter.hit("store", "ip-a", rule).allowed).toBe(true)
  })

  it("al pasar la ventana vuelve a permitir", () => {
    const limiter = new RateLimiter(clock)
    const rule = { limit: 2, windowSeconds: 60 }
    limiter.hit("x", "ip", rule)
    limiter.hit("x", "ip", rule)
    expect(limiter.hit("x", "ip", rule).allowed).toBe(false)
    now += 61_000
    expect(limiter.hit("x", "ip", rule).allowed).toBe(true)
  })

  it("el rechazo no consume cupo (no se extiende el bloqueo reintentando)", () => {
    const limiter = new RateLimiter(clock)
    const rule = { limit: 1, windowSeconds: 60 }
    limiter.hit("x", "ip", rule)
    for (let i = 0; i < 50; i++) limiter.hit("x", "ip", rule)
    now += 61_000
    expect(limiter.hit("x", "ip", rule).allowed).toBe(true)
  })

  it("limpia las entradas vencidas para no crecer sin límite", () => {
    const limiter = new RateLimiter(clock)
    for (let i = 0; i < 100; i++) limiter.hit("x", `ip-${i}`, { limit: 5, windowSeconds: 60 })
    expect(limiter.size()).toBe(100)
    now += 120_000
    limiter.sweep()
    expect(limiter.size()).toBe(0)
  })
})

describe("parseLimits", () => {
  it("sin configuración usa los valores de seguridad.md, SEC-17", () => {
    expect(parseLimits(undefined)).toEqual(DEFAULT_LIMITS)
    expect(DEFAULT_LIMITS.login).toEqual({ limit: 5, windowSeconds: 60 })
    expect(DEFAULT_LIMITS.checkout).toEqual({ limit: 10, windowSeconds: 60 })
    expect(DEFAULT_LIMITS.store).toEqual({ limit: 120, windowSeconds: 60 })
  })

  it("permite cambiar un valor sin tocar el código", () => {
    const limits = parseLimits('{"login":{"limit":3,"windowSeconds":30}}')
    expect(limits.login).toEqual({ limit: 3, windowSeconds: 30 })
    expect(limits.store).toEqual(DEFAULT_LIMITS.store)
  })

  it("ignora configuraciones inválidas y conserva el valor por defecto", () => {
    for (const bad of ["no es json", '{"login":{"limit":0,"windowSeconds":60}}', '{"login":{"limit":5}}', '{"login":"x"}', '{"login":{"limit":99999999,"windowSeconds":60}}', "[]", "null"]) {
      expect(parseLimits(bad)).toEqual(DEFAULT_LIMITS)
    }
  })
})
