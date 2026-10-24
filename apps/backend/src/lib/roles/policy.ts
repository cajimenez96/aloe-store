/**
 * Política de permisos por rol (seguridad.md, SEC-21 y SEC-22).
 *
 * Reglas:
 * - superadmin: todo.
 * - admin: todo, salvo modificar regiones, impuestos, proveedores de pago, claves
 *   de API, usuarios y la tienda de Medusa (solo puede leerlos). Sí puede invitar:
 *   el invitado nace como vendedor.
 * - vendedor: solo lo que figura en VENDEDOR_ALLOWED. Todo lo demás, incluidas las
 *   rutas nuevas, queda denegado por defecto.
 *
 * El rol sale de `user.metadata.role`. Un usuario sin rol, o con un valor
 * desconocido, es vendedor: nunca hay un usuario con más permisos de los que se
 * le asignaron de forma explícita.
 */
export const ROLES = ["superadmin", "admin", "vendedor"] as const
export type Role = (typeof ROLES)[number]

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
const METHODS: readonly string[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

type Rule = { methods: readonly Method[]; path: RegExp }

/** Lo único que puede hacer el vendedor. */
export const VENDEDOR_ALLOWED: readonly Rule[] = [
  // Consulta de productos, stock, pedidos y comprobantes.
  {
    methods: ["GET"],
    path: /^\/admin\/(products|product-categories|inventory-items|stock-locations|orders|transfer-proofs)(\/[^/]+)*$/,
  },
  // El panel pregunta por el usuario actual al cargar.
  { methods: ["GET"], path: /^\/admin\/users\/me$/ },
  // Lectura mínima de configuración sin la cual el panel de Medusa no carga.
  // La respuesta de /admin/stores se entrega sin `metadata` (ver guard.ts).
  {
    methods: ["GET"],
    path: /^\/admin\/(stores|layouts|regions|sales-channels|feature-flags)(\/[^/]+)*$/,
  },
  // Registrar una venta en el local y buscar productos para venderlos.
  { methods: ["POST"], path: /^\/admin\/pos\/sales$/ },
  { methods: ["GET"], path: /^\/admin\/pos\/products$/ },
]

/** Rutas que solo el superadmin puede modificar (el admin las puede leer). */
export const SUPERADMIN_ONLY_WRITE: readonly RegExp[] = [
  /^\/admin\/regions(\/|$)/,
  /^\/admin\/tax-regions(\/|$)/,
  /^\/admin\/tax-rates(\/|$)/,
  /^\/admin\/tax-providers(\/|$)/,
  /^\/admin\/payments\/payment-providers(\/|$)/,
  /^\/admin\/api-keys(\/|$)/,
  /^\/admin\/price-preferences(\/|$)/,
  /^\/admin\/stores(\/|$)/,
  // El rol vive en user.metadata: quien pueda editar usuarios podría ascenderse.
  /^\/admin\/users(\/|$)/,
]

export function resolveRole(metadata: unknown): Role {
  const role =
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).role
      : undefined
  return typeof role === "string" && (ROLES as readonly string[]).includes(role)
    ? (role as Role)
    : "vendedor"
}

/**
 * Devuelve la ruta en forma canónica, o null si es sospechosa: segmentos vacíos
 * o de punto, codificación porcentual o barras invertidas. Una ruta que no es
 * canónica nunca se reconoce, así que se deniega.
 */
function canonicalPath(rawPath: string): string | null {
  // Express enruta sin distinguir mayúsculas (/admin/Regions llega a la misma
  // ruta que /admin/regions), así que la política tampoco las distingue.
  const withoutQuery = rawPath.split("?")[0].toLowerCase()
  const path =
    withoutQuery.length > 1 && withoutQuery.endsWith("/")
      ? withoutQuery.slice(0, -1)
      : withoutQuery
  if (!path.startsWith("/admin") || /[%\\]/.test(path)) {
    return null
  }
  const segments = path.split("/").slice(1)
  if (segments.some((s) => s === "" || s === "." || s === "..")) {
    return null
  }
  return path
}

export function decide(role: Role, method: string, rawPath: string): boolean {
  if (role === "superadmin") {
    return true
  }

  const verb = method.toUpperCase()
  const path = canonicalPath(rawPath)
  if (!path || !METHODS.includes(verb)) {
    return false
  }

  if (role === "admin") {
    return verb === "GET" || !SUPERADMIN_ONLY_WRITE.some((r) => r.test(path))
  }

  return VENDEDOR_ALLOWED.some(
    (rule) => rule.methods.includes(verb as Method) && rule.path.test(path)
  )
}
