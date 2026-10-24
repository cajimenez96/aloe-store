import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { defineConfig } from "@playwright/test"
import { STOREFRONT } from "./helpers/env"

// Si hay un Chromium ya instalado de otra revisión se usa ese; si no, el que baja
// `npx playwright install chromium`.
function cachedChromium(): string | undefined {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM
  const root = path.join(os.homedir(), "Library", "Caches", "ms-playwright")
  try {
    const dir = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().pop()
    if (!dir) return undefined
    const arch = os.arch() === "arm64" ? "mac-arm64" : "mac-x64"
    const exe = path.join(root, dir, `chrome-headless-shell-${arch}`, "chrome-headless-shell")
    return fs.existsSync(exe) ? exe : undefined
  } catch {
    return undefined
  }
}

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  // Los escenarios comparten el mismo backend y el stock: se corren de a uno.
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["json", { outputFile: process.env.E2E_REPORT ?? "../reports/e2e-playwright.json" }]],
  use: {
    baseURL: STOREFRONT,
    actionTimeout: 30_000,
    launchOptions: { executablePath: cachedChromium() },
  },
})
