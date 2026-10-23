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
      // MVP0: el proveedor local solo registra el aviso en la terminal, no envía
      // nada (planning.md, TEC-02). El proveedor real se configura al desplegar.
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
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
