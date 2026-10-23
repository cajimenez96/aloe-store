# Documento de producto: Tienda online + punto de venta (MVP0)

**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `arquitectura.md`

---

## 1. Resumen

Sistema de tienda online con punto de venta local para un comercio minorista. Permite publicar un catálogo de productos, vender por internet con pago con tarjeta (Mercado Pago) o por transferencia bancaria con comprobante, y registrar ventas presenciales en el local. Todo el stock es único y compartido entre la web y el local.

El sistema se construye sobre **Medusa.js 2.22** y se entrega como una instancia por cliente, a partir de una misma base de código. No es una plataforma multitenant.

## 2. Contexto y problema

El comercio vende en el local y quiere vender también por internet, con un único inventario. Hoy no tiene una forma de publicar productos online sin cargarlos por separado, y necesita que las ventas de la web y del local descuenten el mismo stock.

El dueño no quiere depender de un sistema externo para configurar su catálogo: cualquier categoría, talle o color debe poder crearlo él mismo.

## 3. Cliente inicial

- **Rubro:** indumentaria y accesorios de mujer.
- **Catálogo previsto:** bombachas, conjuntos de ropa interior, pijamas, camisones, medias, bolsos, carteras, billeteras, aros y collares.
- **Nombre comercial:** *pendiente*.
- **Cuenta de Mercado Pago:** ya existe.
- **Facturación:** el dueño emite las facturas manualmente desde ARCA, fuera del sistema.
- **Envíos:** el dueño coordina el envío con el cliente. El sistema no integra transportistas en el MVP0.

## 4. Objetivos y métricas de éxito

| Objetivo | Métrica | Meta inicial |
|---|---|---|
| Vender online sin intervención del desarrollador | Productos publicados por el admin sin soporte técnico | 100% de los productos cargados por el dueño |
| Unificar stock entre web y local | Ventas del local que descuentan stock correctamente | 100% |
| Cobrar por ambos medios | Pedidos pagados con tarjeta y con transferencia | Ambos medios operativos al lanzamiento |

*Las metas numéricas de ventas se definirán con el cliente después del lanzamiento.*

## 5. Usuarios y roles

| Rol | Quién es | Puede hacer |
|---|---|---|
| **Superadmin** | Equipo desarrollador | Todo, incluida la configuración técnica. No se usa en el día a día del comercio. |
| **Admin** | Dueño del comercio | Gestionar productos, categorías, talles, colores, promociones, pedidos, transferencias y ventas del local. Configurar el porcentaje de descuento por transferencia. |
| **Vendedor** | Personal del local | Registrar ventas en el local y consultar pedidos. |
| **Cliente** | Comprador online | Navegar el catálogo, comprar como invitado, pagar y subir el comprobante de transferencia. |

**Regla del MVP0:** el vendedor tiene acceso a las funciones de venta, sin acceso a configuración. Los permisos finos por función (por ejemplo, habilitar reembolsos para un vendedor) quedan para el MVP1.

## 6. Alcance

### 6.1 Incluido en MVP0

- Catálogo configurable: categorías en tres niveles (rubro, categoría y subcategoría), productos con título, descripción, imágenes y estado (borrador o publicado).
- Talles y colores como opciones de producto, con variantes generadas por combinación. Cada variante tiene su stock.
- Muestra visual de color, con nombre y selector de color.
- Precio de lista por producto.
- Descuento porcentual por transferencia, configurable por el admin.
- Promociones básicas de Medusa, creadas por el admin.
- Tienda online con listado, búsqueda por texto, filtros por categoría, detalle de producto, carrito y checkout como invitado.
- Pago con tarjeta mediante Mercado Pago Checkout Pro.
- Pago por transferencia con comprobante, con confirmación manual del admin.
- Envío con costo fijo configurable o retiro en el local, sin integración con transportistas.
- Punto de venta local: registrar una venta con productos, medio de pago y total, con descuento de stock.
- Panel de administración de Medusa, con los roles superadmin, admin y vendedor.
- Emails transaccionales de confirmación de pedido y de transferencia recibida o confirmada.

### 6.2 Previsto para MVP1

- Permisos finos por función para el rol vendedor.
- Registro de auditoría para precios, stock, ventas y cambios de configuración.
- Guías de talles reutilizables entre productos.
- Facturación electrónica con ARCA.
- Integración con transportistas (Andreani, OCA o Correo Argentino).
- Cuentas de cliente con historial de compras.
- Cupones con código de uso público.

### 6.3 Fuera de alcance

- Multitenant y venta a otros comercios desde la misma instancia.
- Notificaciones por WhatsApp.
- Reseñas de productos.
- Analítica avanzada.
- Marketplace o múltiples vendedores independientes.
- Restaurantes, delivery o pedidos con preparación.

## 7. Flujos principales

### 7.1 Compra online con tarjeta

1. El cliente explora el catálogo y agrega productos al carrito, eligiendo talle y color.
2. Ingresa datos de contacto y de envío o elige retiro en el local.
3. Elige "Pagar con tarjeta". El total mostrado es el **precio de lista**.
4. Es redirigido a Mercado Pago Checkout Pro y completa el pago.
5. Mercado Pago notifica el resultado. Si el pago fue aprobado, el pedido pasa a **Pagado**.
6. El cliente ve la pantalla de confirmación y recibe un email.

### 7.2 Compra online por transferencia

1. El cliente sigue los pasos 1 y 2 del flujo anterior.
2. Elige "Pagar por transferencia". El total mostrado aplica el **descuento por transferencia** configurado.
3. El sistema muestra los datos bancarios del comercio y el número de pedido, que debe usar como referencia.
4. El pedido queda en estado **Pendiente de pago**.
5. El cliente sube el comprobante desde la página del pedido o desde el enlace del email.
6. El pedido pasa a **Comprobante recibido**.
7. El admin revisa el comprobante contra la cuenta bancaria y lo **confirma** (pedido pasa a **Pagado**) o lo **rechaza** (el pedido vuelve a **Pendiente de pago**, con motivo visible para el cliente).

### 7.3 Venta en el local

1. El vendedor abre el punto de venta desde el panel.
2. Busca productos por nombre o código, y selecciona talle y color.
3. Registra el medio de pago (efectivo, transferencia o tarjeta) y confirma.
4. El sistema descuenta el stock de las variantes vendidas y registra la venta.
5. Se puede imprimir o mostrar un comprobante no fiscal. La factura se emite fuera del sistema.

### 7.4 Carga de un producto por el admin

1. El admin crea las categorías y subcategorías que necesita, si no existen.
2. Crea los talles y colores que usa el producto, con muestra visual para los colores.
3. Crea el producto con título, descripción, imágenes, categoría y precio de lista.
4. Genera las variantes a partir de las combinaciones de talle y color, y carga el stock de cada una.
5. Publica el producto.

## 8. Reglas de negocio

### 8.1 Precios

- Cada producto tiene un **precio de lista**. Es el precio de referencia y el que se cobra con tarjeta.
- El **precio por transferencia** no se guarda en el producto. Se calcula a partir del precio de lista y del porcentaje de descuento configurado por el admin.
- El precio por transferencia se redondea al peso entero más cercano.
- El porcentaje de descuento por transferencia es **uno solo para toda la tienda** en el MVP0.
- El descuento por transferencia solo aplica cuando el cliente elige transferencia. Si cambia de medio de pago, el total se recalcula.
- Los precios se muestran en pesos argentinos (ARS).

### 8.2 Descuentos y promociones

- Las promociones se crean desde el panel de Medusa.
- El descuento por transferencia es una promoción automática asociada al medio de pago de transferencia. El sistema valida que solo se aplique con ese medio de pago.
- Las promociones tienen fecha de inicio y de fin opcionales.

### 8.3 Stock

- El stock es por variante y se comparte entre la tienda online y el punto de venta.
- Una venta, tanto online como en el local, descuenta el stock en el momento de confirmarse el pago o la venta.
- Un pedido pendiente de pago por transferencia **reserva** el stock durante un tiempo configurable. Si vence sin comprobante, el pedido se cancela y el stock se libera.
- El ajuste manual de stock lo hace el admin, con una descripción obligatoria del motivo.

### 8.4 Catálogo

- Ningún talle, color, categoría ni subcategoría viene cargado en el sistema. Todo lo crea el admin.
- Un producto pertenece a una categoría o subcategoría. Puede estar en más de una, aunque la interfaz recomienda una sola.
- Las categorías, talles y colores que ya tienen uso no se eliminan: se **desactivan**. Dejan de aparecer para productos nuevos, pero los pedidos históricos conservan su información.
- Un producto que ya tiene ventas no se elimina: se **despublica**.

### 8.5 Estados del pedido

| Estado | Descripción | Quién lo cambia |
|---|---|---|
| Pendiente de pago | Pedido creado, aún sin pago confirmado. Reserva stock por transferencia. | Sistema |
| Comprobante recibido | El cliente subió el comprobante. Pendiente de revisión. | Sistema (cliente) |
| Pagado | Pago confirmado por Mercado Pago o por el admin. | Sistema o admin |
| Rechazado | El comprobante no coincide con el pago. Vuelve a Pendiente de pago con motivo. | Admin |
| Cancelado | Cancelado por el admin o por vencimiento de la reserva. | Admin o sistema |
| Reembolsado | Devuelto al cliente. | Admin |

### 8.6 Envíos

- El envío puede ser **retiro en el local** (sin costo) o **envío con costo fijo** configurable.
- El envío a domicilio lo coordina el dueño directamente con el cliente. El sistema registra el pedido y el método elegido, sin generar guías ni etiquetas.

### 8.7 Facturación

- El sistema no emite facturas. El dueño factura manualmente desde ARCA.
- El sistema guarda datos suficientes para que el dueño pueda facturar cada pedido: nombre, documento si el cliente lo informa, y total.

## 9. Comprobantes de transferencia

- El cliente puede subir una imagen o PDF del comprobante, de hasta un tamaño que se definirá en la arquitectura.
- Los comprobantes son privados: solo el admin y el cliente que hizo el pedido pueden verlos.
- Un comprobante no es un pago confirmado hasta que el admin lo aprueba.

## 10. Glosario

| Término | Definición |
|---|---|
| Rubro | Área general del negocio. Primer nivel de la jerarquía de categorías. |
| Categoría | Agrupación de productos dentro de un rubro. Segundo nivel. |
| Subcategoría | Agrupación más específica dentro de una categoría. Tercer nivel. |
| Producto | Artículo publicado, con información general y opciones. |
| Opción | Atributo que el producto admite, como talle o color. |
| Variante | Combinación de opciones (por ejemplo, talle M y color negro). Es la unidad que se vende y tiene stock. |
| Precio de lista | Precio de referencia del producto. Se cobra con tarjeta. |
| Precio por transferencia | Precio de lista menos el porcentaje de descuento por transferencia. |
| Comprobante | Imagen o PDF que el cliente sube para acreditar una transferencia. |
| Reserva | Stock apartado para un pedido pendiente de pago. |

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un cliente aplica el descuento de transferencia y paga con tarjeta | Pérdida de margen | El backend valida el medio de pago al completar el pedido. |
| El dueño no puede verificar transferencias a tiempo | Pedidos sin confirmar y clientes insatisfechos | Panel con cola de comprobantes pendientes y aviso por email al admin. |
| Stock reservado que nunca se paga | Stock inmovilizado | Vencimiento configurable de la reserva con liberación automática. |
| Precio de transferencia confuso para el cliente | Reclamos o abandono de compra | Mostrar el precio de lista tachado y el precio por transferencia con el porcentaje, en ficha y carrito. |
| Venta en el local y web del mismo producto al mismo tiempo | Sobreventa | Descuento de stock transaccional y en la misma base de datos. |
| Imagen de marca en productos "tipo" o "inspirados en" marcas conocidas | Riesgo de marca registrada | El dueño revisa la denominación antes de publicar. Fuera del alcance técnico. |

## 12. Preguntas abiertas

1. Nombre comercial del cliente y datos para el sitio.
2. Porcentaje de descuento por transferencia.
3. Tiempo de vencimiento de la reserva de stock para transferencias.
4. Tamaño máximo de los comprobantes y formatos aceptados.
5. Si el envío a domicilio tiene costo fijo y cuál es.
6. Si el punto de venta imprime comprobantes o solo los muestra en pantalla.
7. Quién recibe las notificaciones de comprobantes pendientes.
8. Dominio, hosting y proveedor de email, pendientes para más adelante.

## 13. Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-10-23 | Primera versión del documento de producto. |
