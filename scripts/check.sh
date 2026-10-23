#!/usr/bin/env bash
# Verificaciones locales del proyecto (planning.md, TEC-01).
#   npm run check        lint, tipos, pruebas, auditoria y build
#   npm run check:fast   igual, sin el build (lo usa el hook de pre-push)
set -euo pipefail

cd "$(dirname "$0")/.."

FAST=0
if [ "${1:-}" = "--fast" ]; then
  FAST=1
fi

step() {
  printf '\n==> %s\n' "$1"
}

step "Lint"
npm run lint

step "Tipos"
npm run typecheck --workspaces --if-present

step "Pruebas"
npm run test:unit --workspace @aloe/backend

step "Auditoria de dependencias (falla ante vulnerabilidades criticas)"
npm audit --audit-level=critical

if [ "$FAST" -eq 0 ]; then
  step "Build"
  npm run build
fi

printf '\nTodas las verificaciones pasaron.\n'
