/**
 * Asigna un rol a un usuario del panel (seguridad.md, SEC-21 y SEC-22).
 *
 *   npm run user:role -- <email> <superadmin|admin|vendedor>
 *
 * Un usuario sin rol se trata como vendedor, así que el primer usuario que se
 * crea con `medusa user` necesita este paso para poder administrar.
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { ROLES, type Role } from "../apps/backend/src/lib/roles/policy"

export default async function setUserRole({ container, args }: ExecArgs) {
  const [email, role] = args ?? []

  if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
    throw new Error(
      `Uso: npm run user:role -- <email> <${ROLES.join("|")}>`
    )
  }

  const users = container.resolve(Modules.USER)
  const [user] = await users.listUsers({ email })
  if (!user) {
    throw new Error(`No existe un usuario con el email ${email}.`)
  }

  await users.updateUsers({
    id: user.id,
    metadata: { ...(user.metadata ?? {}), role: role as Role },
  })

  console.log(`Rol de ${email}: ${role}`)
}
