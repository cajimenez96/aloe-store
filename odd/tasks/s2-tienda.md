# Sprint 2 - Tienda (Aloe)

Objective: el cliente ve y elige productos, con notificaciones locales (docs/planning.md v3.1, S2: HU-12, HU-13, HU-14, HU-15, HU-16, TEC-02; 30 puntos).
Branch: main | Runner: vitest (storefront), jest (backend), `npm run check`
Guia visual: `docs/DESIGN.md` (pista transaccional: lienzo crema, tinta negra, botones pill, aloe y pistacho solo como relleno).

## Specs

S1 (HU-12) Base del storefront con el stack definido.
- S1.1 Next.js 16.4.3 fijado sin `^`, con Tailwind CSS, shadcn/ui, Phosphor Icons, Zustand, TanStack Query, Storybook y SDK de Medusa.
- S1.2 Catalogo con Server Components y carrito con Server Actions, segun `arquitectura.md`, seccion 18.
- S1.3 Solo la URL del backend, la clave publicable y el host de imagenes usan `NEXT_PUBLIC_` (SEC-10).
- S1.4 Encabezados de seguridad basicos configurados (SEC-60). La politica CSP completa se termina en HU-44.
- S1.5 Storybook muestra Boton, Tarjeta de producto, Selector de variante y Muestra de color.
- S1.6 El build de produccion (`next build` y `next start`) funciona en local.

S2 (HU-13) Listado de productos: solo publicados del canal "Web"; filtro por rubro, categoria y subcategoria y busqueda por titulo; paginacion; filtros en la URL; la tarjeta muestra el precio de lista y el precio por transferencia (HU-15).
S3 (HU-14) Detalle de producto: solo combinaciones que existen; variantes sin stock marcadas y no se pueden agregar; colores con muestra y nombre; selector accesible con teclado y lector de pantalla; marcador visual si no hay imagen.
S4 (HU-15) Precio por transferencia visible en listado, detalle y carrito; el porcentaje se lee de la promocion de transferencia; coincide con el que calcula Medusa; si la promocion no esta activa, no se muestra.
S5 (HU-16) Estados de carga, vacio y error con los textos del catalogo de `arquitectura.md`, seccion 15.
S6 (TEC-02) Notificaciones locales con el proveedor local de Medusa (canal `email`), suscriptores con reintentos, plantilla base, vista previa `npm run email:preview`, pruebas de renderizado; el MVP0 no envia emails reales.

## Tasks

- T1 | S1 | inline | [x*] | HU-12: dependencias del stack, tokens de DESIGN.md en `globals.css`, `Button`/`Badge`/`Card` (estilo shadcn, copiados a mano; `components.json` listo para `shadcn add`), `ProductCard`, `ColorSwatch`, `VariantSelector` (radios nativos), 15 historias de Storybook, `lib/env.ts`, `lib/price.ts`, `lib/variants.ts`, `lib/medusa.ts` (cliente perezoso), `ui-store` (Zustand), `Providers` (TanStack Query), encabezados de seguridad. 28 pruebas de Vitest con RED observado antes de implementar (env 8, precio 7, variantes 13). Evidencia: lint, tipos, `next build` y `next start` (200, 4 encabezados presentes, la IP de la LAN no responde); `build-storybook` genera 15 historias; vistas en navegador: el selector con talle S deshabilita Rosa y Verde agua, Verde agua sin muestra tiene borde punteado; la tarjeta muestra marcador de imagen, $ 10.000 y "-10% por transferencia $ 9.000". *PENDIENTE: S1.2 (Server Components y Server Actions se usan recien en HU-13 y HU-17); los componentes de shadcn se escribieron a mano, no con su CLI; el selector no se probo con un lector de pantalla real (solo semantica nativa de radios).
- T2 | S2 | - | [ ] | HU-13
- T3 | S3 | - | [ ] | HU-14
- T4 | S4 | - | [ ] | HU-15
- T5 | S5 | - | [ ] | HU-16
- T6 | S6 | - | [ ] | TEC-02

## Log

L1 (2026-10-23, usuario): "si, pusheemos y avancemos". Push de 17 commits a origin/main hecho (24a5375..0bfdc65).
L2: Next 16.4.3 trae `cacheComponents: true` y `partialPrefetching` activados por la plantilla; con `cacheComponents` los Server Components que consultan datos sin cache necesitan `<Suspense>` o `connection()`. La documentacion de la version esta en `node_modules/next/dist/docs/` y se consulta antes de HU-13.
L3: Storybook 10.6 con `@storybook/nextjs-vite` declara soporte para Next 14 a 16. Corre con Vite, asi que Tailwind se aplica con `@tailwindcss/vite` y no con el plugin de Turbopack de Next.
L4: La guia de diseno pide la fuente Neue Haas Grotesk Display (propietaria): se usa Inter con peso 300 para los titulos (`.font-display`). No se aplica `font-feature-settings: ss03` porque en Inter ese conjunto es de comillas y comas, no el de la fuente de la guia.
