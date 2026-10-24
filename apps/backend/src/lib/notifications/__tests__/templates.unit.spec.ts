import { escapeHtml, renderEmail, TEMPLATES } from "../templates"

const shop = { name: "Aloe", contactEmail: "dueno@comercio.com" }

describe("escapeHtml", () => {
  it("escapa los caracteres que abren etiquetas o atributos", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    )
  })

  it("deja el texto normal como está", () => {
    expect(escapeHtml("Camisón de algodón $ 1.500")).toBe("Camisón de algodón $ 1.500")
  })
})

describe("renderEmail", () => {
  it("devuelve asunto, html y texto con los datos del comercio", () => {
    const email = renderEmail("example", { name: "Ana", message: "Tu pedido está listo." }, shop)
    expect(email.subject).toBe("Aviso de Aloe")
    expect(email.html).toContain("Aloe")
    expect(email.html).toContain("Hola Ana")
    expect(email.html).toContain("Tu pedido está listo.")
    expect(email.html).toContain("dueno@comercio.com")
    expect(email.text).toContain("Hola Ana")
    expect(email.text).toContain("Tu pedido está listo.")
    expect(email.text).not.toMatch(/<[a-z]/i)
  })

  it("el html es un documento completo en español", () => {
    const { html } = renderEmail("example", { name: "Ana", message: "x" }, shop)
    expect(html).toMatch(/^<!doctype html>/i)
    expect(html).toContain('lang="es"')
    expect(html).toContain('<meta charset="utf-8">')
  })

  it("escapa los datos del cliente: no se inyecta HTML", () => {
    const { html, text } = renderEmail(
      "example",
      { name: "<img src=x onerror=alert(1)>", message: "<b>hola</b>" },
      shop
    )
    expect(html).not.toContain("<img")
    expect(html).not.toContain("<b>hola</b>")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    // El texto plano no es HTML: se deja tal cual.
    expect(text).toContain("<b>hola</b>")
  })

  it("no deja marcas sin reemplazar", () => {
    const { html, text, subject } = renderEmail("example", { name: "Ana", message: "x" }, shop)
    for (const part of [html, text, subject]) {
      expect(part).not.toMatch(/\{\{|undefined|\[object/)
    }
  })

  it("sin email de contacto no muestra el aviso de contacto", () => {
    const { html, text } = renderEmail(
      "example",
      { name: "Ana", message: "x" },
      { name: "Aloe", contactEmail: null }
    )
    expect(html).not.toContain("Consultas")
    expect(text).not.toContain("Consultas")
  })

  it("falla con una plantilla que no existe", () => {
    expect(() => renderEmail("inventada" as never, {}, shop)).toThrow(/inventada/)
  })

  it("toda plantilla registrada se puede renderizar con datos de ejemplo", () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
      const email = renderEmail(name as keyof typeof TEMPLATES, template.sample, shop)
      expect(email.subject.length).toBeGreaterThan(0)
      expect(email.html.length).toBeGreaterThan(0)
    }
  })
})

describe("plantilla transfer-order (HU-27)", () => {
  const data = { ...TEMPLATES["transfer-order"].sample }

  it("lleva los datos bancarios, el monto, la referencia, el vencimiento y el enlace", () => {
    const email = renderEmail("transfer-order", data, shop)
    expect(email.subject).toContain(data.orderNumber)
    for (const key of ["holder", "cbu", "alias", "bank", "total", "reference", "dueDate", "link"]) {
      expect(email.text).toContain(data[key])
      expect(email.html).toContain(escapeHtml(data[key]))
    }
  })

  it("escapa el nombre del cliente", () => {
    const { html } = renderEmail("transfer-order", { ...data, name: "<script>x</script>" }, shop)
    expect(html).not.toContain("<script>x</script>")
  })
})

describe("todas las plantillas", () => {
  const names = Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]

  it("hay plantillas para los avisos del flujo de transferencia", () => {
    for (const name of ["order-paid", "proof-received-admin", "proof-rejected", "order-canceled"]) {
      expect(names).toContain(name)
    }
  })

  it.each(names)("%s se renderiza completa con sus datos de ejemplo", (name) => {
    const email = renderEmail(name, TEMPLATES[name].sample, shop)
    expect(email.subject.length).toBeGreaterThan(5)
    expect(email.html).toMatch(/^<!doctype html>/i)
    expect(email.text.length).toBeGreaterThan(20)
    // `cause` solo elige el texto de la cancelación; no se muestra tal cual.
    for (const [key, value] of Object.entries(TEMPLATES[name].sample)) {
      if (key !== "cause") expect(email.text).toContain(value)
    }
  })

  it.each(names)("%s escapa HTML en los datos del cliente", (name) => {
    const hostile = Object.fromEntries(Object.keys(TEMPLATES[name].sample).map((key) => [key, "<b>x</b>"]))
    expect(renderEmail(name, hostile, shop).html).not.toContain("<b>x</b>")
  })
})

describe("plantillas con datos sensibles", () => {
  it("el aviso al admin no lleva datos bancarios ni el comprobante", () => {
    const { text } = renderEmail("proof-received-admin", TEMPLATES["proof-received-admin"].sample, shop)
    expect(text).not.toMatch(/cbu|alias|titular|adjunto/i)
  })

  it("la cancelación distingue vencimiento de cancelación del comercio", () => {
    const expired = renderEmail("order-canceled", { ...TEMPLATES["order-canceled"].sample, cause: "expired" }, shop)
    const store = renderEmail("order-canceled", { ...TEMPLATES["order-canceled"].sample, cause: "store" }, shop)
    expect(expired.text).toMatch(/venci/i)
    expect(store.text).toMatch(/comercio/i)
    expect(expired.text).not.toEqual(store.text)
  })
})
