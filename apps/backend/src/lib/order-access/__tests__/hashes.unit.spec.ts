import { addTokenHash, tokenMatches } from "../hashes"
import { generateToken, hashToken } from "../token"

describe("varios tokens válidos por pedido", () => {
  it("un token emitido después no invalida los anteriores", () => {
    const a = generateToken()
    const b = generateToken()
    let metadata: Record<string, unknown> = addTokenHash({}, hashToken(a))
    metadata = addTokenHash(metadata, hashToken(b))
    expect(tokenMatches(a, metadata)).toBe(true)
    expect(tokenMatches(b, metadata)).toBe(true)
    expect(tokenMatches(generateToken(), metadata)).toBe(false)
  })

  it("conserva el resto de la metadata", () => {
    expect(addTokenHash({ payment_method: "transfer" }, "h".repeat(64))).toMatchObject({ payment_method: "transfer" })
  })

  it("guarda como máximo 5 y descarta los más viejos", () => {
    const tokens = Array.from({ length: 7 }, () => generateToken())
    let metadata: Record<string, unknown> = {}
    for (const token of tokens) metadata = addTokenHash(metadata, hashToken(token))
    expect((metadata.access_token_hashes as string[]).length).toBe(5)
    expect(tokenMatches(tokens[0], metadata)).toBe(false)
    expect(tokenMatches(tokens[6], metadata)).toBe(true)
  })

  it("sin hashes (pedido sin token) nada coincide", () => {
    expect(tokenMatches(generateToken(), {})).toBe(false)
    expect(tokenMatches(generateToken(), { access_token_hashes: "no-es-lista" })).toBe(false)
  })
})
