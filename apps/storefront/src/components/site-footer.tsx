import Link from "next/link"

/** Pie de página con los enlaces legales (planning.md, HU-48). */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-canvas-light">
      <nav
        aria-label="Información legal"
        className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm text-shade-60"
      >
        <Link href="/terminos" className="hover:text-ink">
          Términos y condiciones
        </Link>
        <Link href="/privacidad" className="hover:text-ink">
          Política de privacidad
        </Link>
      </nav>
    </footer>
  )
}
