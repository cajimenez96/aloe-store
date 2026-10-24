import fs from "node:fs"
import path from "node:path"
import type { Seed } from "./api"

export const loadSeed = (): Seed => JSON.parse(fs.readFileSync(path.join(__dirname, "..", ".seed.json"), "utf8"))
