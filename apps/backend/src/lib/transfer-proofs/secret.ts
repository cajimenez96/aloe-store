/** Clave con la que se firman los enlaces de comprobantes; la misma del backend (SEC-10). */
export function proofSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.COOKIE_SECRET
  if (!secret) throw new Error("Falta JWT_SECRET para firmar los enlaces de comprobantes.")
  return secret
}
