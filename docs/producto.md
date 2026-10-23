# Documento de producto: Tienda online + punto de venta (MVP0)

**Versión:** 2
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `arquitectura.md` (cómo se construye), `seguridad.md` (cómo se protege), `planning.md` (cómo se organiza el trabajo)

---

## 1. Resumen

Sistema de tienda online con punto de venta local para un comercio minorista. Permite publicar un catálogo, vender por internet con tarjeta (Mercado Pago) o por transferencia bancaria con comprobante, y registrar ventas en el local. El stock es único y lo comparten la web y el local.

El sistema se construye sobre **Medusa.js 2.22** y usa, siempre que sea posible, lo que Medusa trae de fábrica. Se entrega como una instancia por cliente, desplegada en **Coolify** sobre una VPS. No es multitenant.

## 2. Contexto y problema

El comercio vende en el local y quiere vender también por internet, con un único inventario. Necesita:

- Cargar su catálogo sin depender de un desarrollador.
- Que las ventas de la web y del local descuenten el mismo stock.
- Cobrar con tarjeta y por transferencia, con un precio menor por transferencia.

## 3. Cliente inicial

| Dato | Valor |
|---|---|
| Rubro | Ropa interior, descanso y accesorios de mujer |
| Catálogo previsto | Bombachas, conjuntos de ropa interior, pijamas, camisones, medias, bolsos, carteras, billeteras, aros y collares |
| Nombre comercial | Pendiente |
| Cuenta de Mercado Pago | Existe |
| Condición fiscal | Pendiente (monotributo o responsable inscripto). Afecta la configuración de impuestos. |
| Facturación | Manual desde ARCA, fuera del sistema |
| Envíos | Los coordina el dueño con el cliente. Sin integración con transportistas. |

## 4. Principio rector del MVP0

**Se usa lo que Medusa ofrece de fábrica. Solo se desarrolla lo que el negocio no puede resolver con la plataforma.**

Desarrollo propio previsto para el MVP0:

1. Subida y revisión de comprobantes de transferencia.
2. Aplicación y validación del descuento por transferencia según el medio de pago.
3. Cancelación automática de pedidos por transferencia vencidos.
4. Acceso seguro del cliente invitado a su pedido.
5. Pantalla de punto de venta dentro del panel de Medusa.
6. Muestra visual de colores.
7. Restricción de permisos del vendedor, solo si Medusa no la resuelve de forma nativa.

Cualquier otra pieza propia necesita justificarse antes de entrar al plan.

## 5. Usuarios y roles

| Rol | Quién es | Puede hacer |
|---|---|---|
| **Superadmin** | Equipo desarrollador | Todo, incluida la configuración técnica de Medusa (regiones, impuestos, proveedores, claves de API). No opera el negocio día a día. |
| **Admin** | Dueño del comercio | Catálogo, stock, promociones, pedidos, revisión de comprobantes, ventas del local, datos bancarios y usuarios vendedores. |
| **Vendedor** | Personal del local | Registrar ventas en el local, consultar productos, stock y pedidos. Sin acceso a configuración, precios ni usuarios. |
| **Cliente** | Comprador online | Comprar como invitado, pagar, subir comprobante y consultar su pedido. |

## 6. Alcance

### 6.1 Incluido en el MVP0

**Catálogo (nativo de Medusa)**
- Categorías en tres niveles: rubro, categoría y subcategoría.
- Productos con título, descripción, imágenes y estado (borrador o publicado).
- Opciones de talle y color por producto, con variantes y stock por variante.
- Muestra visual para cada color.
- Precio de lista por variante.

**Tienda online**
- Listado con búsqueda y filtro por categoría.
- Detalle de producto con selección de talle y color.
- Carrito y compra como invitado.
- Retiro en el local o envío con costo fijo.
- Pago con tarjeta mediante Mercado Pago Checkout Pro.
- Pago por transferencia con comprobante.

**Gestión**
- Panel de Medusa para catálogo, stock, pedidos, pagos, reembolsos y promociones.
- Revisión de comprobantes de transferencia.
- Punto de venta en el local con stock compartido.
- Roles superadmin, admin y vendedor.
- Emails transaccionales.

### 6.2 Previsto para el MVP1

- Botón de arrepentimiento (ver sección 11, riesgo legal).
- Registro de auditoría de precios, stock y configuración.
- Facturación electrónica con ARCA.
- Integración con transportistas (Andreani, OCA o Correo Argentino).
- Cuentas de cliente con historial.
- Guías de talles reutilizables.

### 6.3 Fuera de alcance

- Multitenant.
- Notificaciones por WhatsApp.
- Reseñas, analítica avanzada y marketplace.

## 7. Flujos principales

### 7.1 Compra con tarjeta

1. El cliente arma el carrito eligiendo talle y color.
2. Ingresa sus datos y elige retiro o envío.
3. Elige "Tarjeta". El total es el **precio de lista**.
4. Es redirigido a Mercado Pago y paga.
5. Mercado Pago notifica al sistema. El sistema consulta el pago directamente a Mercado Pago y, si está aprobado y el monto coincide, el pedido queda **pagado**.
6. El cliente ve la confirmación y recibe un email con el enlace a su pedido.

El momento exacto en que se crea el pedido (antes o después del pago) se define en el spike de Mercado Pago. Ver `arquitectura.md`, sección 10.

### 7.2 Compra por transferencia

1. El cliente arma el carrito e ingresa sus datos.
2. Elige "Transferencia". El total aplica el **descuento por transferencia**.
3. El pedido se crea con el pago pendiente, y el stock queda reservado.
4. El sistema muestra y envía por email los datos bancarios, el monto exacto, la referencia y la fecha de vencimiento.
5. El cliente sube el comprobante desde el enlace de su pedido.
6. El admin revisa el comprobante contra su cuenta bancaria:
   - **Si lo acepta**, captura el pago y el pedido queda pagado.
   - **Si lo rechaza**, indica el motivo. El cliente puede subir otro comprobante mientras el pedido no venza.
7. Si el pedido vence sin un comprobante aceptado, se cancela y el stock se libera.

### 7.3 Venta en el local

1. El vendedor abre el punto de venta dentro del panel.
2. Busca productos por nombre o SKU y elige la variante.
3. Indica el medio de pago (efectivo, transferencia o tarjeta) y confirma.
4. La venta queda registrada en el canal "Local", con el pago ya cobrado, y descuenta stock.
5. Puede mostrar o imprimir un comprobante no fiscal.

### 7.4 Carga de catálogo

1. El admin crea las categorías que necesita.
2. Crea el producto, define sus opciones de talle y color y genera las variantes.
3. Asigna la muestra visual a cada color.
4. Carga precio y stock de cada variante.
5. Publica el producto.

## 8. Reglas de negocio

### 8.1 Precios y descuento por transferencia

- Cada variante tiene un **precio de lista**, que se cobra con tarjeta.
- El **descuento por transferencia** es un porcentaje único para toda la tienda. Lo configura el admin en la promoción correspondiente del panel de Medusa, que es la única fuente de ese valor.
- El descuento solo se aplica cuando el medio de pago es transferencia. Si el cliente cambia de medio, el total se recalcula.
- El precio por transferencia lo calcula Medusa y puede incluir centavos. No se aplica un redondeo propio.
- Los precios están en pesos argentinos (ARS) y se muestran con impuestos incluidos.

### 8.2 Stock y reservas

- El stock es por variante y se comparte entre la web y el local.
- Un pedido creado reserva el stock de sus variantes.
- Un pedido por transferencia sin comprobante aceptado vence después del plazo configurado (24 horas por defecto). Al vencer se cancela y libera el stock.
- Para evitar que alguien bloquee el stock con pedidos falsos, hay límites de pedidos pendientes por email y por conexión, y un máximo de unidades por variante en cada pedido. Los valores se definen en `seguridad.md`.

### 8.3 Catálogo

- Ningún talle, color ni categoría viene cargado. Todo lo crea el admin.
- Un producto pertenece a una sola subcategoría (o categoría, si no tiene subcategorías). **Pendiente de confirmación** con el dueño.
- Las categorías en uso no se eliminan: se desactivan.
- Un producto con ventas no se elimina: se despublica.

### 8.4 Estados del pedido

Los estados del negocio se apoyan en los estados nativos de Medusa (estado del pedido y estado del pago). El único estado propio es el del comprobante.

| Estado para el negocio | Qué significa |
|---|---|
| Pendiente de pago | Pedido creado, pago todavía no cobrado. |
| Comprobante en revisión | El cliente subió un comprobante y el admin no lo revisó. |
| Comprobante rechazado | El admin rechazó el último comprobante. El cliente puede subir otro. |
| Pagado | Pago cobrado por Mercado Pago o capturado por el admin. |
| Cancelado | Cancelado por el admin o por vencimiento. |
| Reembolsado | Pago devuelto, total o parcialmente. |

La correspondencia con los estados de Medusa está en `arquitectura.md`, sección 8.

### 8.5 Envíos

- Retiro en el local, sin costo.
- Envío con costo fijo, que el dueño coordina con el cliente.

### 8.6 Punto de venta

- Las ventas del local se registran en un canal de venta propio ("Local"), separado de la web.
- El pago se registra como cobrado en el momento.
- **Pendiente de confirmación:** si el efectivo o la transferencia en el local tienen descuento.

### 8.7 Facturación

El sistema no emite facturas. Conserva nombre, email, documento (si se informa) y total de cada pedido para que el dueño facture desde ARCA.

## 9. Comprobantes de transferencia

- Formatos aceptados: JPG, PNG y PDF, de hasta 5 MB.
- Son privados: solo el admin, el vendedor con permiso de lectura y el cliente del pedido pueden verlos.
- Un comprobante no confirma el pago. Lo confirma el admin al capturar el pago.

## 10. Glosario

| Término | Definición |
|---|---|
| Rubro, categoría, subcategoría | Niveles de la jerarquía de categorías. |
| Opción | Atributo de un producto, como talle o color. |
| Variante | Combinación de opciones (por ejemplo, talle M y color negro). Es lo que se vende y tiene stock. |
| Precio de lista | Precio de la variante. Se cobra con tarjeta. |
| Descuento por transferencia | Porcentaje que se descuenta cuando el pago es por transferencia. |
| Canal de venta | Origen de la venta: "Web" o "Local". |
| Capturar un pago | Marcar un pago como cobrado. En transferencias lo hace el admin al aceptar el comprobante. |
| Reserva | Stock apartado para un pedido no pagado. |

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Botón de arrepentimiento fuera del MVP0.** Es una obligación legal vigente para la venta online en Argentina. | Alto: sanciones al comercio si la tienda se abre al público sin él. | Decisión tomada de dejarlo fuera del MVP0. Se recomienda resolverlo antes de abrir las ventas al público. Ver `planning.md`, riesgos. |
| Descuento de transferencia usado con tarjeta | Pérdida de margen | Validación en el backend al completar el pedido. |
| Pedidos falsos que bloquean stock | Ventas perdidas | Vencimiento corto y límites de pedidos pendientes. |
| Comprobantes sin revisar a tiempo | Clientes insatisfechos | Aviso por email al admin y cola de revisión. |
| Sobreventa entre web y local | Reclamos | Stock único con reservas nativas y pruebas de concurrencia. |
| Compromiso del servidor | Pérdida de datos y fraude | Controles de `seguridad.md`. |

## 12. Preguntas abiertas

1. Nombre comercial y dominio.
2. Condición fiscal (monotributo o responsable inscripto).
3. Porcentaje de descuento por transferencia.
4. Si el efectivo o la transferencia en el local tienen descuento.
5. Si un producto puede estar en más de una subcategoría.
6. Costo del envío a domicilio.
7. Proveedor de email.
8. Email que recibe los avisos de comprobantes.

## 13. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión. |
| 2026-10-23 | 2 | Revisión completa: principio de usar lo nativo de Medusa, transferencias sobre el proveedor manual, estados apoyados en Medusa, descuento con una sola fuente, canal "Local" para el punto de venta, control de abuso de reservas, todo en Coolify, botón de arrepentimiento registrado como riesgo. |
