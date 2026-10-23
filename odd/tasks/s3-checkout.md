# Sprint 3 - Carrito y checkout (Aloe)

Objective: el cliente arma el carrito, compra como invitado, elige envio y medio de pago (docs/planning.md v3.1, S3: HU-17, HU-18, HU-19, HU-20, HU-21, HU-22).
Branch: main | Delivery: commits por unidad, push solo con OK del usuario | Runner: jest (backend), vitest (storefront), `npm run check`

## Specs

S1 (HU-17) Carrito: agregar, quitar y cambiar cantidades; vive en Medusa y su id en una cookie `HttpOnly`, `Secure` (al desplegar), `SameSite=Lax` (SEC-61); el storefront nunca envia precios, solo variantes y cantidades (SEC-30); se mantiene al recargar.
S2 (HU-18) "Sin stock suficiente se muestra `STOCK_INSUFFICIENT` con la cantidad disponible." "Superar el maximo por variante muestra `MAX_UNITS_EXCEEDED` (SEC-40)." "Una variante despublicada en el carrito se quita con un aviso (`VARIANT_UNAVAILABLE`)."
S3 (HU-19) Invitado: nombre, email y telefono obligatorios, documento opcional; formato validado con mensajes junto a cada campo; sin contrasena; los errores se corrigen sin perder lo cargado.
S4 (HU-20) Retiro o envio: opciones nativas de HU-04; el envio suma su costo fijo; direccion obligatoria solo para envio.
S5 (HU-21) Medio de pago: `POST /store/checkout/:cart_id/payment-method` aplica o quita la promocion con el codigo interno (SEC-31); tarjeta = total de lista, transferencia = con descuento; no se confirma sin medio elegido.
S6 (HU-22) "Un hook en el flujo de completar carrito rechaza con `DISCOUNT_PAYMENT_MISMATCH` cualquier carrito con la promocion y un proveedor distinto del manual."; prueba automatizada con promocion + tarjeta que falla; el codigo de la promocion no aparece en la API de tienda.

## Tasks

- T1 | S2 | inline | [x*] | HU-18 backend: `lib/cart-limits/check.ts` (6 pruebas con RED observado) y hooks `validate` de agregar y cambiar cantidad en `workflows/hooks/validate-cart-items.ts`. Evidencia en vivo (base descartable): M x1 200; M x6 `MAX_UNITS_EXCEEDED`; sumar hasta pasar el stock `STOCK_INSUFFICIENT` con `available:3`; variante sin stock `available:0`; variante de producto en borrador `VARIANT_UNAVAILABLE`; cambiar linea a 4 rechazado y a 3 aceptado. *PENDIENTE: Medusa responde HTTP 400 en los tres (el contrato es `code`, documentado en arquitectura 15.2); la variante sin precio la rechaza Medusa con otro mensaje; no hay prueba de integracion automatizada de los hooks, solo la unitaria de la logica y la verificacion en vivo; despublicar un producto con el carrito ya armado se atiende en T3.
- T2 | S1 | inline | [ ] | HU-17 storefront: cookie de carrito, Server Actions, pagina /carrito, enlace en el encabezado
- T3 | S2 | inline | [ ] | HU-18 storefront: avisos y retiro de variantes no disponibles
- T4 | S3,S4 | inline | [ ] | HU-19 y HU-20
- T5 | S5,S6 | inline | [ ] | HU-21 y HU-22

## Log

L1 (2026-10-23, usuario): "perfecto, pusheemos y avancemos con lo demas". Push de TEC-02 hecho (0bfdc65..acfc8fc).
L2: Medusa ya rechaza stock insuficiente con un mensaje generico (`INSUFFICIENT_INVENTORY`); para devolver `STOCK_INSUFFICIENT` con la cantidad disponible el hook `validate` lo calcula antes con `getVariantAvailability`.
