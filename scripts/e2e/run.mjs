#!/usr/bin/env node
/**
 * Pruebas de punta a punta (planning.md, HU-46) contra los BUILDS DE PRODUCCIÓN del
 * backend y del storefront, en local y con una base de datos descartable.
 *
 *   npm run e2e
 *
 * Qué hace: crea una base nueva, migra y configura la tienda, compila y levanta el
 * backend (`medusa start`, :9300) y el storefront (`next start`, :3100), corre los
 * escenarios de Playwright, revisa que el log del servidor no tenga datos personales
 * (SEC-70), guarda el reporte con el commit probado y lo borra todo.
 * Necesita PostgreSQL de `docker compose up -d`. Nunca usa la base de desarrollo.
 */
import { spawn, execFileSync, execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..")
const BACKEND_DIR = path.join(ROOT, "apps", "backend")
const SERVER_DIR = path.join(BACKEND_DIR, ".medusa", "server")
const STORE_DIR = path.join(ROOT, "apps", "storefront")
const BACKEND_URL = "http://localhost:9300"
const STOREFRONT_URL = "http://localhost:3100"
const ADMIN = { email: "qa@aloe.local", password: "QaScratch-2026-abc" }
const SELLER = { email: "vend@aloe.local", password: "VendScratch-2026-abc" }
const SENTINELS = ["Zulema", "Quintana", "1177778888", "30987654", "Calle Secreta", "Ciudad Reservada", "0170099220000067797370", "Titular Reservado", "alias.reservado", "CONTENIDO-COMPROBANTE-SECRETO"]

const log = (message) => console.log(`\n[e2e] ${message}`)
const dbName = `medusa_e2e_${Date.now()}`
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aloe-e2e-"))
const children = []
let backendLog = path.join(workDir, "backend.log")
let exitCode = 1

function baseDatabaseUrl() {
  const env = fs.readFileSync(path.join(BACKEND_DIR, ".env"), "utf8")
  const url = env.split("\n").find((line) => line.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).trim()
  if (!url) throw new Error("No encuentro DATABASE_URL en apps/backend/.env (se usa solo para conocer el servidor de PostgreSQL).")
  return url.slice(0, url.lastIndexOf("/"))
}

const sql = (statement) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-c", statement], { cwd: ROOT, stdio: "pipe" })

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: options.quiet ? "pipe" : "inherit", cwd: options.cwd ?? ROOT, env: { ...process.env, ...options.env } })
}

function start(name, command, args, options) {
  const out = fs.openSync(options.logFile ?? path.join(workDir, `${name}.log`), "a")
  const child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ["ignore", out, out], detached: false })
  children.push(child)
  return child
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.status < 500) return
    } catch {
      // todavía no está
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`${label} no respondió en ${timeoutMs / 1000} s.`)
}

const git = (command) => {
  try {
    return execSync(command, { cwd: ROOT, encoding: "utf8" }).trim()
  } catch {
    return null
  }
}

async function main() {
  const databaseUrl = `${baseDatabaseUrl()}/${dbName}`
  const proofsDir = path.join(workDir, "proofs")

  const backendEnv = {
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    REDIS_URL: "",
    PORT: "9300",
    MEDUSA_BACKEND_URL: BACKEND_URL,
    STOREFRONT_URL,
    STORE_CORS: STOREFRONT_URL,
    ADMIN_CORS: BACKEND_URL,
    AUTH_CORS: BACKEND_URL,
    JWT_SECRET: "e2e-jwt-secret-0123456789abcdef",
    COOKIE_SECRET: "e2e-cookie-secret-0123456789abcdef",
    PROOFS_DIR: proofsDir,
    // Límites holgados: los escenarios simulan muchos clientes desde una sola máquina.
    RATE_LIMITS: JSON.stringify({ login: { limit: 1000, windowSeconds: 60 }, checkout: { limit: 1000, windowSeconds: 60 }, store: { limit: 10000, windowSeconds: 60 } }),
    MAX_PENDING_PER_EMAIL: "1000",
    MAX_PENDING_PER_IP: "1000",
    TRUSTED_PROXY_HOPS: "1",
    // El build de producción exige HTTPS para la cookie de sesión; en local se permite por http.
    INSECURE_SESSION_COOKIE: "true",
    LOG_LEVEL: "http",
  }

  log(`Base descartable ${dbName}`)
  sql(`create database ${dbName}`)

  log("Compilando el backend (producción)")
  run("npm", ["run", "build", "-w", "@aloe/backend"], { env: backendEnv, quiet: true })

  log("Migrando y configurando la tienda")
  const devEnv = { ...backendEnv, NODE_ENV: "development" }
  run("npx", ["medusa", "db:migrate"], { cwd: BACKEND_DIR, env: devEnv, quiet: true })
  run("npx", ["medusa", "exec", "../../scripts/setup-store.ts"], { cwd: BACKEND_DIR, env: devEnv, quiet: true })
  run("npx", ["medusa", "user", "-e", ADMIN.email, "-p", ADMIN.password], { cwd: BACKEND_DIR, env: devEnv, quiet: true })
  run("npx", ["medusa", "exec", "../../scripts/set-user-role.ts", ADMIN.email, "superadmin"], { cwd: BACKEND_DIR, env: devEnv, quiet: true })
  run("npx", ["medusa", "user", "-e", SELLER.email, "-p", SELLER.password], { cwd: BACKEND_DIR, env: devEnv, quiet: true })

  log("Levantando el backend de producción en :9300")
  start("backend", "npx", ["medusa", "start", "--host", "127.0.0.1"], { cwd: SERVER_DIR, env: backendEnv, logFile: backendLog })
  await waitFor(`${BACKEND_URL}/health`, "El backend")

  const loginResponse = await fetch(`${BACKEND_URL}/auth/user/emailpass`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ADMIN) })
  const adminToken = (await loginResponse.json()).token
  const keys = await (await fetch(`${BACKEND_URL}/admin/api-keys?type=publishable`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()
  const publishableKey = keys.api_keys.find((key) => key.title === "Tienda web").token

  log("Compilando y levantando el storefront de producción en :3100")
  const storeEnv = {
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: BACKEND_URL,
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_IMAGES_HOST: "localhost:9300",
    TRUSTED_PROXY_HOPS: "",
  }
  run("npx", ["next", "build"], { cwd: STORE_DIR, env: storeEnv, quiet: true })
  start("storefront", "npx", ["next", "start", "-p", "3100", "-H", "127.0.0.1"], { cwd: STORE_DIR, env: storeEnv })
  await waitFor(`${STOREFRONT_URL}/productos`, "El storefront")

  const playwrightEnv = {
    E2E_BACKEND_URL: BACKEND_URL,
    E2E_STOREFRONT_URL: STOREFRONT_URL,
    E2E_ADMIN_EMAIL: ADMIN.email,
    E2E_ADMIN_PASSWORD: ADMIN.password,
    E2E_SELLER_EMAIL: SELLER.email,
    E2E_SELLER_PASSWORD: SELLER.password,
    E2E_BACKEND_DIR: SERVER_DIR,
    E2E_REPORT: path.join(ROOT, "reports", "e2e-playwright.json"),
    DATABASE_URL: databaseUrl,
    NODE_ENV: "production",
    JWT_SECRET: backendEnv.JWT_SECRET,
    COOKIE_SECRET: backendEnv.COOKIE_SECRET,
    PROOFS_DIR: proofsDir,
    STOREFRONT_URL,
    REDIS_URL: "",
  }

  // E2E_KEEP=1 deja todo levantado para depurar: corré `npx playwright test -c e2e/playwright.config.ts`
  // con las variables de `reports/.e2e-env.json` y cerrá este proceso con Ctrl+C al terminar.
  if (process.env.E2E_KEEP === "1") {
    fs.writeFileSync(path.join(ROOT, "reports", ".e2e-env.json"), JSON.stringify({ ...playwrightEnv, backendLog }, null, 2))
    log("Entorno levantado (E2E_KEEP=1). Ctrl+C para limpiar.")
    await new Promise(() => {})
  }

  log("Corriendo los escenarios de Playwright")
  const reportFile = path.join(ROOT, "reports", "e2e-playwright.json")
  fs.mkdirSync(path.dirname(reportFile), { recursive: true })
  let playwrightOk = true
  try {
    run("npx", ["playwright", "test", "-c", "e2e/playwright.config.ts", ...(process.env.E2E_GREP ? ["--grep", process.env.E2E_GREP] : [])], { env: { ...playwrightEnv, E2E_REPORT: reportFile } })
  } catch {
    playwrightOk = false
  }

  log("Revisando que el log del servidor no tenga datos personales (SEC-70)")
  const logText = fs.readFileSync(backendLog, "utf8")
  const leaks = SENTINELS.filter((value) => logText.includes(value))
  const lines = logText.split("\n").filter(Boolean)
  const jsonLines = lines.filter((line) => {
    try {
      JSON.parse(line)
      return true
    } catch {
      return false
    }
  })
  const securityEvents = [...new Set(jsonLines.map((line) => JSON.parse(line)).map((entry) => (typeof entry.message === "string" && entry.message.startsWith("{") ? JSON.parse(entry.message).event : entry.event)).filter(Boolean))]
  // Avisos del propio Node o de librerías que no pasan por el logger de la aplicación: la tienda
  // de sesiones en memoria (esta suite no usa Redis a propósito, para no tocar el de desarrollo)
  // y una deprecación de `pg`. Cualquier otra línea que no sea JSON es un defecto.
  const RUNTIME_WARNINGS = /MemoryStore|designed for a production environment|memory, and will not scale|DeprecationWarning|trace-deprecation/
  const unexpectedNonJson = lines.filter((line) => !jsonLines.includes(line) && !RUNTIME_WARNINGS.test(line))
  console.log(`  líneas: ${lines.length}, en JSON: ${jsonLines.length}, filtraciones: ${leaks.length ? leaks.join(", ") : "ninguna"}`)

  const playwrightReport = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : null
  const stats = playwrightReport?.stats ?? {}
  const report = {
    scenario: "e2e-produccion",
    generatedAt: new Date().toISOString(),
    gitCommit: git("git rev-parse --short HEAD"),
    workingTreeClean: git("git status --porcelain") === "",
    environment: { backend: "medusa start (build de producción)", storefront: "next start (build de producción)", node: process.version },
    playwright: { expected: stats.expected ?? null, unexpected: stats.unexpected ?? null, skipped: stats.skipped ?? null, flaky: stats.flaky ?? null },
    logs: { lines: lines.length, jsonLines: jsonLines.length, allApplicationLogsJson: unexpectedNonJson.length === 0, runtimeWarnings: lines.length - jsonLines.length - unexpectedNonJson.length, unexpectedNonJson: unexpectedNonJson.slice(0, 8).map((line) => line.slice(0, 140)), personalDataLeaks: leaks, eventsSeen: securityEvents },
    passed: playwrightOk && leaks.length === 0 && unexpectedNonJson.length === 0,
  }
  fs.writeFileSync(path.join(ROOT, "reports", "e2e-produccion.json"), JSON.stringify(report, null, 2) + "\n")
  console.log(JSON.stringify(report, null, 2))
  exitCode = report.passed ? 0 : 1
}

async function cleanup() {
  for (const child of children) {
    try {
      child.kill("SIGTERM")
    } catch {
      // ya terminó
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
  try {
    sql(`drop database if exists ${dbName} with (force)`)
  } catch {
    console.error(`[e2e] No pude borrar la base ${dbName}: borrala a mano.`)
  }
  fs.rmSync(workDir, { recursive: true, force: true })
  fs.rmSync(path.join(STORE_DIR, ".next-e2e"), { recursive: true, force: true })
}

process.on("SIGINT", async () => {
  await cleanup()
  process.exit(130)
})

try {
  await main()
} catch (error) {
  console.error(`\n[e2e] Falló: ${error instanceof Error ? error.message : error}`)
  exitCode = 1
  try {
    const tail = fs.readFileSync(backendLog, "utf8").split("\n").slice(-15).join("\n")
    console.error(`\n--- final del log del backend ---\n${tail}`)
  } catch {
    // sin log
  }
} finally {
  await cleanup()
}
process.exit(exitCode)
