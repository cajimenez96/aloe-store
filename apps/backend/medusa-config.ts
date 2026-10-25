import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { readMpConfig } from "./src/lib/mercadopago/config"
import { assertStrongSecrets } from "./src/lib/config/secrets"
import { sessionCookieOptions } from "./src/lib/config/session"

loadEnv(process.env.NODE_ENV || "development", process.cwd())
assertStrongSecrets(process.env)

const mp = readMpConfig(process.env)
const redisUrl = process.env.REDIS_URL
const backendUrl = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

module.exports = defineConfig({
  admin: {
    // El panel limita por defecto cada imagen a 1 MB; las fotos de producto pueden llegar a 5 MB.
    maxUploadFileSize: 5 * 1024 * 1024,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    // Solo para correr el build de producción por http en local (README: INSECURE_SESSION_COOKIE).
    cookieOptions: sessionCookieOptions(process.env),
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: [
    { resolve: "./src/modules/product-color" },
    { resolve: "./src/modules/transfer-proof" },
    {
      // Imágenes de producto en local. La URL pública se arma con
      // MEDUSA_BACKEND_URL; el proveedor no la lee por su cuenta.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: { backend_url: `${backendUrl}/static` },
          },
        ],
      },
    },
    {
      // MVP0: el proveedor no envía nada; deja constancia en el log sin datos
      // personales (planning.md, TEC-02 y HU-49). `LOG_EMAIL_BODIES=true` agrega el
      // texto para probar los enlaces en desarrollo. El proveedor real va al desplegar.
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/log-notification",
            id: "log",
            options: { channels: ["email"] },
          },
        ],
      },
    },
    // Pago con tarjeta (Mercado Pago). Solo se registra con MP_ACCESS_TOKEN; sin él la tienda
    // acepta únicamente transferencia (el proveedor manual de Medusa sigue disponible).
    ...(mp.enabled
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "./src/modules/mercadopago-payment",
                  id: "mercadopago",
                  options: {
                    accessToken: mp.accessToken,
                    apiBase: mp.apiBase,
                    notificationUrl: mp.notificationUrl,
                    backUrlBase: mp.backUrlBase,
                  },
                },
              ],
            },
          },
        ]
      : []),
    ...(redisUrl
      ? [
          {
            resolve: "@medusajs/medusa/event-bus-redis",
            options: { redisUrl },
          },
          {
            resolve: "@medusajs/medusa/workflow-engine-redis",
            options: { redis: { redisUrl } },
          },
        ]
      : []),
  ],
})
