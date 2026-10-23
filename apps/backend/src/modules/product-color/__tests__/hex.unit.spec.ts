import { normalizeHex } from "../hex"

describe("normalizeHex", () => {
  it("acepta #RRGGBB y lo devuelve en mayúsculas", () => {
    expect(normalizeHex("#112233")).toBe("#112233")
    expect(normalizeHex("#aabbcc")).toBe("#AABBCC")
    expect(normalizeHex("#A1b2C3")).toBe("#A1B2C3")
  })

  it("ignora espacios alrededor", () => {
    expect(normalizeHex("  #ff00aa ")).toBe("#FF00AA")
  })

  it("rechaza lo que no es #RRGGBB", () => {
    for (const bad of [
      "",
      "112233",
      "#123",
      "#1234567",
      "#GGHHII",
      "rojo",
      "#11 22 33",
      "rgb(1,2,3)",
      "#112233;",
      "#11223g",
      "##112233",
    ]) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })

  it("rechaza valores que no son texto", () => {
    for (const bad of [null, undefined, 123456, {}, [], true]) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })
})
