import { describe, expect, it } from "vitest"
import { buildCsp } from "../csp"

const base = { backendUrl: "http://localhost:9000", imagesHost: "localhost:9000", isDev: false }
const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name)

describe("buildCsp (SEC-60, HU-44)", () => {
  const csp = buildCsp(base)

  it("por defecto solo permite el propio origen", () => {
    expect(directive(csp, "default-src")).toBe("default-src 'self'")
  })

  it("las conexiones permiten el propio origen, el backend y Mercado Pago", () => {
    const connect = directive(csp, "connect-src")!
    expect(connect).toContain("'self'")
    expect(connect).toContain("http://localhost:9000")
    expect(connect).toContain("https://api.mercadopago.com")
    expect(connect).not.toContain("*  ")
    expect(connect).not.toMatch(/\s\*(\s|$)/)
  })

  it("las imágenes permiten el host de imágenes configurado", () => {
    const img = directive(csp, "img-src")!
    expect(img).toContain("'self'")
    expect(img).toContain("http://localhost:9000")
    expect(img).toContain("data:")
  })

  it("con un host de imágenes real usa https", () => {
    const prod = buildCsp({ backendUrl: "https://api.aloe.com", imagesHost: "cdn.aloe.com", isDev: false })
    expect(directive(prod, "img-src")).toContain("https://cdn.aloe.com")
    expect(directive(prod, "img-src")).not.toContain("http://cdn.aloe.com")
    expect(directive(prod, "connect-src")).toContain("https://api.aloe.com")
  })

  it("bloquea objetos, base, iframes propios y formularios a otros orígenes", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'")
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'")
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'")
    const form = directive(csp, "form-action")!
    expect(form).toContain("'self'")
    expect(form).toContain("mercadopago")
    expect(form).not.toMatch(/\s\*(\s|$)/)
  })

  it("'unsafe-eval' solo en desarrollo", () => {
    expect(directive(csp, "script-src")).not.toContain("unsafe-eval")
    expect(directive(buildCsp({ ...base, isDev: true }), "script-src")).toContain("'unsafe-eval'")
  })

  it("los scripts permiten solo el propio origen y el SDK de Mercado Pago", () => {
    const script = directive(csp, "script-src")!
    expect(script).toContain("'self'")
    expect(script).toContain("https://sdk.mercadopago.com")
    expect(script).not.toMatch(/https?:\/\/(?!sdk\.mercadopago\.com)/)
  })

  it("upgrade-insecure-requests solo cuando el backend usa https (en local por http rompería)", () => {
    expect(csp).not.toContain("upgrade-insecure-requests")
    expect(buildCsp({ backendUrl: "https://api.aloe.com", imagesHost: "cdn.aloe.com", isDev: false })).toContain(
      "upgrade-insecure-requests"
    )
  })

  it("es una sola línea, sin saltos que un encabezado no admite", () => {
    expect(csp).not.toMatch(/[\r\n]/)
  })

  it("un backend o host de imágenes inválido no deja entrar nada raro", () => {
    const weird = buildCsp({ backendUrl: "no es una url; script-src *", imagesHost: "x y; img-src *", isDev: false })
    expect(weird).not.toContain("script-src *")
    expect(weird).not.toContain("img-src *")
  })
})
