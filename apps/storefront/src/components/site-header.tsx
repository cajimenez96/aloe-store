import Link from "next/link"

export function SiteHeader() {
  return (
    <header className="border-b border-hairline bg-canvas-light">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/productos" className="font-display text-2xl">
          Aloe
        </Link>
      </div>
    </header>
  )
}
