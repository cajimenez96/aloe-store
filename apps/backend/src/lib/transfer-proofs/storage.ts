import { randomBytes } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const KEY_PATTERN = /^[a-f0-9]{48}$/

/**
 * Almacenamiento privado de comprobantes en local (seguridad.md, SEC-51): fuera de
 * `static/`, que es público. Al desplegar se reemplaza por el almacenamiento externo.
 */
export function proofsDir(): string {
  return process.env.PROOFS_DIR ?? path.join(process.cwd(), "storage", "private", "proofs")
}

/** Guarda el archivo con un nombre generado, sin el original ni extensión. */
export async function saveProof(buffer: Buffer): Promise<string> {
  const key = randomBytes(24).toString("hex")
  await mkdir(proofsDir(), { recursive: true, mode: 0o700 })
  await writeFile(path.join(proofsDir(), key), buffer, { mode: 0o600, flag: "wx" })
  return key
}

export async function readProof(key: string): Promise<Buffer | null> {
  if (!KEY_PATTERN.test(key)) return null
  try {
    return await readFile(path.join(proofsDir(), key))
  } catch {
    return null
  }
}
