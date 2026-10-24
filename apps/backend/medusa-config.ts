import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const redisUrl = process.env.REDIS_URL
const backendUrl = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
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
