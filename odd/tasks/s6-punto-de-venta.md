# Sprint 6 - Punto de venta (Aloe)

Objective: el vendedor registra ventas del local, el admin hace el cierre de caja y la tienda tiene su politica de contenido (docs/planning.md v3.1: HU-34, HU-35, HU-36, HU-37, HU-32, HU-33, HU-44).
Branch: main | Delivery: commits por unidad, push solo con OK del usuario | Runner: jest (backend), vitest (storefront), `npm run check`

## Specs

S1 (HU-34) "Una ruta del panel, construida con Medusa UI, permite armar la venta con variantes y cantidades." "Medio de pago: efectivo, transferencia o tarjeta." "La venta se crea en el canal \"Local\", con el pago capturado, y descuenta stock." "Una venta vacía devuelve `SALE_ITEMS_EMPTY`." "Funciona en una pantalla de tablet y con teclado." Bloqueante abierto: si el efectivo o la transferencia en el local tienen descuento (SUPUESTO: no tienen; el precio es el de lista).
S2 (HU-35) "Búsqueda por título y SKU." "Se ven las variantes con su stock disponible." "Una variante sin stock no se puede agregar."
S3 (HU-36) "Dice \"Documento no fiscal\"." "Incluye ítems, total, medio de pago, fecha y número de venta." "Se imprime desde el navegador."
S4 (HU-37) "Total por medio de pago para la fecha elegida." "Lista de ventas con hora y usuario." "Solo incluye el canal \"Local\"."
S5 (HU-32) "El listado nativo de pedidos permite filtrar por canal y estado de pago." "El detalle del pedido muestra un bloque con el estado del último comprobante y un acceso a él."
S6 (HU-33) "La cancelación y el reembolso se hacen con las acciones nativas del panel." "La cancelación libera el stock."
S7 (HU-44) "CSP que permite solo el propio origen, el backend, el host de imágenes y Mercado Pago (SEC-60). HSTS queda para el despliegue." "Encabezados de SEC-60 presentes en todas las respuestas." "El checkout con Mercado Pago funciona con la política activa."

## Tasks

- T1 | S1,S2,S4 | inline | [x*] | HU-34, HU-35 y HU-37 backend: `lib/pos/{sale,day}.ts` (14 pruebas), `POST /admin/pos/sales` (arma un carrito en el canal Local, agrega los items por el flujo normal para que corran las validaciones de stock, completa con el proveedor manual, captura el pago y cumple los items para bajar el stock), `GET /admin/pos/products?q=` (titulo y SKU, stock disponible en Local, escapa comodines), `GET /admin/pos/sales?date=` (admin: total por medio de pago, lista con hora y usuario, solo canal Local, dia en hora de Argentina); el maximo por variante no rige en el canal Local; el vendedor puede buscar y vender, no ver las ventas del dia. Evidencia en vivo (base descartable): venta en efectivo en canal Local con pago `captured` y pedido `fulfilled`, el stock fisico baja (20 a 18 a 10) sin reservas colgadas; 8 unidades en el local pasan (online dan `MAX_UNITS_EXCEEDED`); venta vacia 422 `SALE_ITEMS_EMPTY`; medio invalido 422; variante sin stock 400 `STOCK_INSUFFICIENT`; un precio manipulado se ignora (total 1.500); sin sesion 401; busqueda 'pij' por titulo y 'COR-M' por SKU con 'SIN STOCK' marcado, '%' no devuelve todo; ventas del dia 24.500 (efectivo 7.000, transferencia 16.000, tarjeta 1.500) con el usuario de cada una; vendedor recibe 403 en las ventas del dia; fecha invalida 422. *PENDIENTE: los productos tienen que estar en el canal Local ademas de Web para poder venderse en el local (hay que cargarlos en ambos); no hay devolucion ni anulacion de una venta del local mas alla de las acciones nativas del panel; `dayBounds` fija Argentina en UTC-3; el descuento en el local sigue sin definirse (supuesto: ninguno); varias pruebas se escribieron junto con su implementacion sin observar un RED separado.
- T2 | S1,S2,S3 | inline | [ ] | pantalla del panel Punto de venta (buscar, armar, cobrar, comprobante no fiscal)
- T3 | S4 | inline | [ ] | pantalla del panel Ventas del dia
- T4 | S5,S6 | inline | [ ] | HU-32 y HU-33: bloque de comprobante en el pedido y documento de reembolso
- T5 | S7 | inline | [ ] | HU-44: politica de contenido

## Log

L1 (2026-10-24): el descuento por pagar en efectivo o transferencia en el local sigue siendo una pregunta abierta al dueno. Se implementa sin descuento y se deja anotado.
