import { describe, expect, it } from "vitest"
import { parsePublicEnv } from "../env"

const valid = {
  NEXT_PUBLIC_MEDUSA_BACKEND_URL: "http://localhost:9000",
  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "pk_0123456789abcdef",
  NEXT_PUBLIC_IMAGES_HOST: "localhost:9000",
}

describe("parsePublicEnv", () => {
  it("lee las tres variables públicas", () => {
    expect(parsePublicEnv(valid)).toEqual({
      backendUrl: "http://localhost:9000",
      publishableKey: "pk_0123456789abcdef",
      imagesHost: "localhost:9000",
    })
  })

  it("quita la barra final de la URL del backend", () => {
    expect(
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_BACKEND_URL: "http://localhost:9000/" })
        .backendUrl
    ).toBe("http://localhost:9000")
  })

  it("exige la URL del backend", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_BACKEND_URL: undefined })
    ).toThrow(/NEXT_PUBLIC_MEDUSA_BACKEND_URL/)
  })

  it("rechaza una URL de backend que no es http ni https", () => {
    for (const bad of ["localhost:9000", "ftp://x.com", "javascript:alert(1)", ""]) {
      expect(() =>
        parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_BACKEND_URL: bad })
      ).toThrow(/NEXT_PUBLIC_MEDUSA_BACKEND_URL/)
    }
  })

  it("la clave publicable es opcional al leer, pero si está debe empezar con pk_", () => {
    expect(
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: undefined })
        .publishableKey
    ).toBe("")
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "sk_secreta" })
    ).toThrow(/NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY/)
  })

  it("el host de imágenes es host o host:puerto, sin esquema ni ruta", () => {
    expect(
      parsePublicEnv({ ...valid, NEXT_PUBLIC_IMAGES_HOST: undefined }).imagesHost
    ).toBe("")
    expect(
      parsePublicEnv({ ...valid, NEXT_PUBLIC_IMAGES_HOST: "imagenes.tienda.com" })
        .imagesHost
    ).toBe("imagenes.tienda.com")
    for (const bad of ["http://localhost:9000", "localhost:9000/static", "a b"]) {
      expect(() =>
        parsePublicEnv({ ...valid, NEXT_PUBLIC_IMAGES_HOST: bad })
      ).toThrow(/NEXT_PUBLIC_IMAGES_HOST/)
    }
  })

  it("junta todos los errores en un solo mensaje", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_MEDUSA_BACKEND_URL: "x",
        NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "sk_x",
        NEXT_PUBLIC_IMAGES_HOST: "http://x",
      })
    ).toThrow(
      /NEXT_PUBLIC_MEDUSA_BACKEND_URL[\s\S]*NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY[\s\S]*NEXT_PUBLIC_IMAGES_HOST/
    )
  })

  it("no repite el valor de la clave en el error", () => {
    try {
      parsePublicEnv({ ...valid, NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: "sk_muy_secreta" })
    } catch (error) {
      expect(String(error)).not.toContain("sk_muy_secreta")
    }
  })
})
