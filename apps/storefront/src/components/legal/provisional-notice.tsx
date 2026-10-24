/**
 * Marca visible de que el texto legal es provisorio (planning.md, HU-48). Se retira
 * al publicar la versión revisada por un profesional (HU-53, etapa de despliegue).
 */
export function ProvisionalNotice() {
  return (
    <p
      role="note"
      className="rounded-md border border-ink bg-pistachio px-4 py-3 text-sm"
      data-testid="provisional-notice"
    >
      <strong>Texto provisorio.</strong> Este documento es un borrador y todavía no fue revisado por un profesional. No
      tiene validez legal hasta que se publique la versión definitiva.
    </p>
  )
}
