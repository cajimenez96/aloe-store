export const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:9300"
export const STOREFRONT = process.env.E2E_STOREFRONT_URL ?? "http://localhost:3100"
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "qa@aloe.local"
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "QaScratch-2026-abc"
export const SELLER_EMAIL = process.env.E2E_SELLER_EMAIL ?? "vend@aloe.local"
export const SELLER_PASSWORD = process.env.E2E_SELLER_PASSWORD ?? "VendScratch-2026-abc"

// Datos reconocibles para comprobar que no terminan en los logs (SEC-70).
export const SENTINELS = {
  name: "Zulema Quintana",
  phone: "1177778888",
  document: "30987654",
  street: "Calle Secreta 4321",
  cbu: "0170099220000067797370",
  holder: "Titular Reservado SRL",
  proofMarker: "CONTENIDO-COMPROBANTE-SECRETO",
}
