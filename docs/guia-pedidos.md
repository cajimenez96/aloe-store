# Guía de pedidos (para el dueño)

Cómo atender pedidos desde el panel (`/app`). Todo se hace con las acciones nativas de Medusa, salvo los comprobantes de transferencia y el punto de venta.

## Pedidos online por transferencia

1. El cliente confirma el pedido y recibe un email con los datos para transferir.
2. Cuando sube el comprobante, llega un aviso al email de avisos (si lo configuraste) y aparece en **Comprobantes**.
3. En **Comprobantes** podés abrir el archivo, ver si ya se usó en otro pedido y **Aceptar** (el pago queda cobrado y el cliente recibe un email) o **Rechazar** con un motivo de 10 a 300 caracteres (el cliente lo ve y puede subir otro).
4. Si pasa el plazo sin un comprobante aceptado ni en revisión, el pedido se cancela solo y el stock se libera.

El detalle de cada pedido muestra el estado de su último comprobante.

## Cancelar un pedido

Desde el detalle del pedido, **Cancel**. Libera el stock reservado. El cliente recibe un email que dice que lo canceló el comercio.

## Reembolsar

Desde el detalle del pedido, en el bloque de pago, **Refund**. Se puede reembolsar el total o una parte. En el MVP0 el dinero se devuelve **por fuera del sistema** (transferencia al cliente); el panel solo registra el reembolso.

> Pagos con Mercado Pago: cuando esté integrado (SP-02) se define si el reembolso se ejecuta desde acá o desde Mercado Pago. Hasta entonces, se devuelve desde la cuenta de Mercado Pago y se registra el reembolso en el pedido.

## Buscar y filtrar pedidos

El listado de pedidos filtra por **canal de venta** (Web o Local), región y fechas. Medusa 2.22 **no** trae un filtro por estado de pago: la columna de pago se ve en el listado y la cola de **Comprobantes** muestra lo que falta revisar.

## Ventas del local

- **Punto de venta**: arma la venta, elegí efectivo, transferencia o tarjeta y registrá. Baja el stock y queda en el canal Local. El producto tiene que estar cargado también en el canal **Local** para poder venderse ahí.
- **Ventas del día** (solo admin): total por medio de pago y lista de ventas del día elegido, para el cierre de caja.
- El comprobante que se imprime dice **Documento no fiscal**.
