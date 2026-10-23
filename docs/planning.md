# Planificación del MVP0: Tienda online + punto de venta

**Versión:** 2.1
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `producto.md`, `arquitectura.md`, `seguridad.md`

---

## 1. Objetivo

Organizar el trabajo del MVP0 en épicas, historias de usuario, tareas técnicas y spikes, con criterios de aceptación verificables, repartidos en sprints con un objetivo claro.

Este documento es la fuente inicial del backlog. Una vez cargado en la herramienta de gestión elegida, ambos deben mantenerse sincronizados.

## 2. Metodología: Scrum con tablero Kanban

- **Scrum** marca la cadencia: sprints de 2 semanas con planificación, revisión y retrospectiva.
- **Kanban** gestiona el flujo diario: tablero con límites de trabajo en curso y métricas de tiempo de ciclo.

| Parámetro | Valor |
|---|---|
| Duración del sprint | 2 semanas |
| Capacidad | **Supuesto: 30 puntos por sprint con un desarrollador a tiempo completo.** Se calibra con la velocidad real de S0 y S1. |
| Escala | Fibonacci: 1, 2, 3, 5, 8. Una historia de más de 8 puntos se divide. |

## 3. Roles

| Rol | Responsabilidad |
|---|---|
| Product Owner | Prioriza el backlog y acepta o rechaza historias. |
| Facilitador | Conduce las ceremonias, cuida los límites de trabajo en curso y resuelve bloqueos. |
| Equipo de desarrollo | Estima, desarrolla, prueba y entrega. |
| Dueño del comercio | Responde preguntas de negocio y valida en las demos. No cambia el sprint en curso. |

En un equipo chico una persona puede ocupar varios roles, pero aceptar una historia y desarrollarla deben ser actos separados.

## 4. Tablero

| Columna | Significado | Límite |
|---|---|---|
| Backlog | Historia descrita, sin priorizar para el sprint. | — |
| Lista | Cumple la Definition of Ready. | — |
| En progreso | En desarrollo. | 2 por persona |
| En revisión | Pull request abierto. | 3 |
| En staging | Desplegada en staging, en validación. | 3 |
| Hecha | Cumple la Definition of Done. | — |

**Tipos de ticket:** `HU` historia de usuario, `TEC` tarea técnica, `SP` spike (investigación con entregable escrito), `BUG` defecto en una historia ya hecha.

## 5. Definition of Ready y Definition of Done

### 5.1 Definition of Ready

- [ ] Descripción en formato "Como [rol], quiero [acción], para [beneficio]".
- [ ] Criterios de aceptación verificables.
- [ ] Puntos estimados.
- [ ] Dependencias resueltas o planificadas antes.
- [ ] Preguntas bloqueantes respondidas.
- [ ] Puntos **[Verificar]** de la arquitectura que la afectan, resueltos en SP-01 o SP-02.

### 5.2 Definition of Done

**Antes del lanzamiento:**
- [ ] Criterios de aceptación cumplidos.
- [ ] Lint, pruebas, build y auditoría de dependencias en verde en CI.
- [ ] Pruebas automatizadas para la lógica propia y las rutas nuevas.
- [ ] Revisión de código (o checklist de autorrevisión si el equipo es de una persona).
- [ ] Controles de `seguridad.md` que aplican a la historia, cumplidos.
- [ ] Desplegada y validada en staging.
- [ ] Aceptada por el Product Owner.
- [ ] Documentación afectada actualizada.

**Después del lanzamiento:** además, desplegada y verificada en producción.

## 6. Épicas

| ID | Épica | Objetivo |
|---|---|---|
| E01 | Infraestructura | Entorno local, servidor endurecido, staging y configuración base de Medusa |
| E02 | Catálogo | El dueño carga su catálogo con las herramientas nativas |
| E03 | Tienda | El cliente encuentra y elige productos |
| E04 | Carrito y checkout | Pedido completo con medio de pago y envío |
| E05 | Mercado Pago | Pago con tarjeta seguro y conciliado |
| E06 | Transferencias | Pago por transferencia con comprobante |
| E07 | Pedidos | Gestión, cancelación y reembolso con herramientas nativas |
| E08 | Punto de venta | Ventas en el local con stock compartido |
| E09 | Usuarios y roles | Acceso con permisos mínimos |
| E10 | Emails | Avisos al cliente y al dueño |
| E11 | Seguridad | Controles de `seguridad.md` que no pertenecen a otra épica |
| E12 | Calidad y lanzamiento | Pruebas, textos legales, monitoreo y salida a producción |

---

## 7. Backlog

### E01 · Infraestructura

#### HU-01 · Entorno de desarrollo reproducible
- **Sprint:** S0 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como desarrollador, quiero levantar todo el sistema en local con un comando, para trabajar en un entorno igual al de los servidores.
- **Criterios de aceptación:**
  - [ ] `docker compose up` levanta PostgreSQL, Redis, Medusa servidor, Medusa worker y storefront en una máquina limpia.
  - [ ] PostgreSQL y Redis tienen healthchecks y los demás servicios esperan a que estén listos.
  - [ ] Existen `.env.example` del backend y del storefront con todas las variables de `arquitectura.md`, sección 17.5, sin valores reales.
  - [ ] El README explica cómo levantar, detener, reiniciar desde cero y crear el primer usuario.

#### HU-02 · Servidor y Coolify endurecidos
- **Sprint:** S0 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como responsable técnico, quiero el servidor y Coolify configurados de forma segura, para que un compromiso no ponga en riesgo la tienda.
- **Criterios de aceptación:**
  - [ ] SSH solo con clave, sin login de root ni contraseña (SEC-01).
  - [ ] Firewall con solo 22, 80 y 443 abiertos y bloqueo de IPs con intentos fallidos (SEC-01).
  - [ ] Panel de Coolify accesible solo por VPN o IP permitida, con doble factor (SEC-02).
  - [ ] Coolify en la última versión estable, sin avisos críticos abiertos (SEC-03).
  - [ ] Actualizaciones de seguridad automáticas del sistema operativo.
  - [ ] Un escaneo de puertos externo muestra solo 22 (o ninguno, si se restringe por IP), 80 y 443.

#### HU-03 · Staging en Coolify
- **Sprint:** S0 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como equipo, quiero un entorno de staging en Coolify, para validar cada historia antes de producción.
- **Criterios de aceptación:**
  - [ ] Storefront, servidor de Medusa, worker, PostgreSQL y Redis corren como servicios del mismo proyecto.
  - [ ] PostgreSQL y Redis no publican puertos (SEC-04).
  - [ ] Storefront y backend responden por HTTPS con HSTS (SEC-15).
  - [ ] Los secretos están cargados solo en Coolify y son distintos de los de desarrollo (SEC-10).
  - [ ] CORS configurado con los dominios exactos de staging (SEC-16).
  - [ ] Un nuevo despliegue no borra datos y corre las migraciones antes de iniciar.

#### HU-04 · Configuración base de Medusa
- **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como superadmin, quiero la tienda configurada con región, moneda, impuestos, canales, stock, envíos y proveedores de pago, para que el dueño pueda empezar a cargar productos.
- **Criterios de aceptación:**
  - [ ] Región Argentina con ARS como moneda por defecto.
  - [ ] Precios configurados con impuestos incluidos.
  - [ ] Canales de venta "Web" y "Local", y clave publicable asociada a "Web".
  - [ ] Ubicación de stock "Local" asociada a ambos canales.
  - [ ] Opciones de envío "Retiro en el local" y "Envío a domicilio" con costo fijo.
  - [ ] Proveedor manual habilitado en la región.
  - [ ] La configuración se reproduce con un script o una guía paso a paso del README.
  - [ ] No se carga ningún dato de catálogo.
- **Bloqueante:** condición fiscal del cliente, para la alícuota de impuestos.

#### HU-05 · Imágenes de producto en R2
- **Sprint:** S0 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero subir imágenes de producto, para mostrarlas en la tienda.
- **Criterios de aceptación:**
  - [ ] Las imágenes subidas desde el panel quedan en R2 y su URL usa el dominio `S3_FILE_URL`.
  - [ ] Archivos de más de 5 MB o de formato no permitido se rechazan con un mensaje claro (SEC-50).
  - [ ] El bucket no permite listar su contenido (SEC-52).
- **Bloqueante:** dominio para imágenes. En staging puede usarse un subdominio provisorio.

#### HU-06 · Respaldos cifrados y restauración probada
- **Sprint:** S5 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero respaldos diarios fuera del servidor, para recuperar la tienda si la VPS falla.
- **Criterios de aceptación:**
  - [ ] Respaldo diario de PostgreSQL, cifrado, en un bucket exclusivo con credenciales propias (SEC-90).
  - [ ] Retención de 30 días.
  - [ ] Una restauración completa en staging fue probada y quedó registrada.
  - [ ] Una falla del respaldo genera una alerta (SEC-96).

#### TEC-01 · Integración continua
- **Sprint:** S0 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como equipo, quiero que cada cambio pase por lint, pruebas, build y auditoría de dependencias, para detectar errores y vulnerabilidades antes de staging.
- **Criterios de aceptación:**
  - [ ] Cada pull request ejecuta lint, pruebas y build de backend y storefront.
  - [ ] La auditoría de dependencias bloquea el merge si hay vulnerabilidades críticas (SEC-80).
  - [ ] Las actualizaciones de dependencias se proponen de forma automática.
  - [ ] Un pull request con fallos no puede integrarse.

#### SP-01 · Verificación técnica de Medusa 2.22
- **Sprint:** S0 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como equipo, quiero confirmar todos los puntos **[Verificar]** de la arquitectura contra la versión instalada, para no construir sobre supuestos.
- **Criterios de aceptación:**
  - [ ] Documento con la respuesta a cada punto **[Verificar]** de `arquitectura.md` y `seguridad.md`, con la fuente consultada.
  - [ ] Incluye como mínimo: roles nativos (RBAC) en la versión de código abierto, `metadata` en valores de opción, visibilidad de la `metadata` de `Store` y de pedidos en la API de tienda, convención de montos, estado del pago con el proveedor manual, recálculo de la sesión de pago al cambiar promociones, liberación de reservas al cancelar, pedidos borrador para el punto de venta, modo servidor y worker, mecanismo de sesión del panel, precios con impuestos incluidos y límite de solicitudes nativo.
  - [ ] `arquitectura.md` actualizado con las respuestas.

### E02 · Catálogo

#### HU-07 · Categorías en tres niveles
- **Sprint:** S1 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero crear rubros, categorías y subcategorías, para organizar el catálogo.
- **Criterios de aceptación:**
  - [ ] Puedo crear, renombrar, reordenar y anidar categorías desde el panel nativo de Medusa.
  - [ ] Puedo desactivar una categoría, y deja de mostrarse en la tienda.
  - [ ] Ninguna categoría viene cargada.
  - [ ] Existe una guía breve para el dueño que explica la convención de tres niveles.
- **Bloqueante:** si un producto puede estar en más de una subcategoría.

#### HU-08 · Productos con talles, colores y variantes
- **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero crear un producto con sus talles, colores, precios y stock por variante, para venderlo en la web y en el local.
- **Criterios de aceptación:**
  - [ ] Puedo crear el producto con título, descripción, imágenes y categoría desde el panel nativo.
  - [ ] Puedo definir las opciones "Talle" y "Color" con los valores que necesito.
  - [ ] Medusa genera las variantes y no permite combinaciones repetidas.
  - [ ] Cada variante tiene precio de lista en ARS.
  - [ ] El producto se crea como borrador.

#### HU-09 · Muestra visual de color
- **Sprint:** S1 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero asignar una muestra visual a cada color, para que el cliente la vea en la tienda.
- **Criterios de aceptación:**
  - [ ] Una extensión del panel permite asignar un color `#RRGGBB` a cada valor de la opción "Color".
  - [ ] Un valor inválido muestra un error y no se guarda.
  - [ ] La muestra se guarda donde definió SP-01 (metadata o módulo propio).
  - [ ] Un color sin muestra se ve en la tienda con su nombre y un borde neutro.

#### HU-10 · Stock por variante
- **Sprint:** S1 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero cargar y ajustar el stock de cada variante, para que la tienda muestre lo que realmente hay.
- **Criterios de aceptación:**
  - [ ] Puedo cargar y modificar el stock por variante en la ubicación "Local" desde el panel nativo.
  - [ ] Una variante sin stock disponible no se puede agregar al carrito.

#### HU-11 · Publicar y despublicar
- **Sprint:** S1 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero publicar o despublicar productos, para controlar qué ve el cliente.
- **Criterios de aceptación:**
  - [ ] Solo los productos publicados y asignados al canal "Web" aparecen en la tienda.
  - [ ] Un producto despublicado sigue apareciendo en los pedidos anteriores.

### E03 · Tienda

#### HU-12 · Base del storefront
- **Sprint:** S2 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como desarrollador, quiero la base del storefront con el stack definido, para construir la tienda sobre componentes documentados.
- **Criterios de aceptación:**
  - [ ] Next.js 16.4.3 fijado sin `^`, con Tailwind CSS, shadcn/ui, Phosphor Icons, Zustand, TanStack Query, Storybook y SDK de Medusa.
  - [ ] Catálogo con Server Components y carrito con Server Actions, según `arquitectura.md`, sección 18.
  - [ ] Solo la URL del backend, la clave publicable y el dominio de imágenes usan `NEXT_PUBLIC_` (SEC-10).
  - [ ] Encabezados de seguridad básicos configurados (SEC-60). La política CSP completa se termina en HU-44.
  - [ ] Storybook muestra Botón, Tarjeta de producto, Selector de variante y Muestra de color.
  - [ ] Imagen Docker en modo `standalone` desplegada en staging.

#### HU-13 · Listado de productos
- **Sprint:** S2 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver el catálogo, filtrarlo por categoría y buscar por texto, para encontrar productos rápido.
- **Criterios de aceptación:**
  - [ ] Solo se muestran productos publicados del canal "Web".
  - [ ] Filtro por rubro, categoría y subcategoría, y búsqueda por título.
  - [ ] Paginación.
  - [ ] Los filtros quedan en la URL para compartir o volver atrás.
  - [ ] La tarjeta muestra el precio de lista y el precio por transferencia (HU-15).

#### HU-14 · Detalle de producto
- **Sprint:** S2 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir talle y color en la ficha del producto, para comprar la variante exacta.
- **Criterios de aceptación:**
  - [ ] Solo puedo elegir combinaciones que existen como variante.
  - [ ] Las variantes sin stock se ven marcadas y no se pueden agregar.
  - [ ] Los colores se muestran con su muestra visual y su nombre, sin depender solo del color.
  - [ ] El selector es accesible con teclado y lector de pantalla.
  - [ ] Si no hay imagen, se muestra un marcador visual en lugar de una imagen rota.

#### HU-15 · Precio por transferencia visible
- **Sprint:** S2 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver el precio por transferencia antes de pagar, para decidir sin sorpresas.
- **Criterios de aceptación:**
  - [ ] En listado, detalle y carrito se ve el precio de lista y el precio por transferencia con el porcentaje.
  - [ ] El porcentaje se lee de la promoción de transferencia. No existe otro lugar donde se configure.
  - [ ] El precio mostrado coincide con el que calcula Medusa al elegir transferencia en el checkout.
  - [ ] Si la promoción no está activa, no se muestra precio por transferencia.

#### HU-16 · Estados de carga, vacío y error
- **Sprint:** S2 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero mensajes claros mientras algo carga, cuando no hay resultados o cuando algo falla, para saber qué hacer.
- **Criterios de aceptación:**
  - [ ] Listado y detalle muestran un esqueleto de carga.
  - [ ] Sin resultados: mensaje y botón para limpiar filtros.
  - [ ] Error de red: mensaje y botón para reintentar.
  - [ ] Los mensajes de error usan los textos del catálogo de `arquitectura.md`, sección 15.

#### SP-02 · Mercado Pago: plugin o proveedor propio, y creación del pedido
- **Sprint:** S2 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como equipo, quiero decidir cómo integrar Mercado Pago y cuándo se crea el pedido, para desarrollar los pagos sobre una base confiable.
- **Criterios de aceptación:**
  - [ ] Evaluación de los plugins disponibles con los criterios de SEC-81: código, actividad, licencia y compatibilidad con 2.22.
  - [ ] Verificación de que el plugin elegido valida la firma del webhook como indica SEC-32, o plan para hacerlo.
  - [ ] Decisión sobre el momento de creación del pedido (`arquitectura.md`, sección 10.2).
  - [ ] Prueba de concepto en sandbox con un pago aprobado y uno rechazado.
  - [ ] Decisión registrada en `arquitectura.md`.

### E04 · Carrito y checkout

#### HU-17 · Carrito
- **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero un carrito que se mantenga al recargar la página, para no perder lo que elegí.
- **Criterios de aceptación:**
  - [ ] Puedo agregar, quitar y cambiar cantidades.
  - [ ] El carrito vive en Medusa y su identificador en una cookie `HttpOnly`, `Secure`, `SameSite=Lax` (SEC-61).
  - [ ] El storefront nunca envía precios, solo variantes y cantidades (SEC-30).
  - [ ] El carrito se mantiene al recargar en el mismo navegador.

#### HU-18 · Validaciones del carrito
- **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero saber si una variante no está disponible o supera el máximo, para corregir el pedido antes de pagar.
- **Criterios de aceptación:**
  - [ ] Sin stock suficiente se muestra `STOCK_INSUFFICIENT` con la cantidad disponible.
  - [ ] Superar el máximo por variante muestra `MAX_UNITS_EXCEEDED` (SEC-40).
  - [ ] Una variante despublicada en el carrito se quita con un aviso (`VARIANT_UNAVAILABLE`).

#### HU-19 · Compra como invitado
- **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero comprar sin crear una cuenta, para terminar rápido.
- **Criterios de aceptación:**
  - [ ] Nombre, email y teléfono obligatorios. Documento opcional (SEC-70).
  - [ ] Validación de formato de email y teléfono, con mensajes junto a cada campo.
  - [ ] No se pide contraseña.
  - [ ] Los errores se pueden corregir sin perder lo ya cargado.

#### HU-20 · Retiro o envío
- **Sprint:** S3 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir retiro en el local o envío, para recibir la compra como prefiero.
- **Criterios de aceptación:**
  - [ ] Se muestran las opciones de envío nativas configuradas en HU-04.
  - [ ] El envío suma su costo fijo al total.
  - [ ] Para envío, la dirección es obligatoria. Para retiro, no se pide.

#### HU-21 · Elegir medio de pago
- **Sprint:** S3 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir tarjeta o transferencia y ver el total actualizado, para saber cuánto voy a pagar.
- **Criterios de aceptación:**
  - [ ] Con tarjeta, el total es el de lista. Con transferencia, aplica el descuento.
  - [ ] El cambio pasa por `POST /store/checkout/:cart_id/payment-method`, que aplica o quita la promoción con el código interno (SEC-31).
  - [ ] Al cambiar de medio, el total y la sesión de pago se actualizan antes de confirmar.
  - [ ] No se puede confirmar sin medio de pago elegido.

#### HU-22 · Descuento solo con transferencia
- **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que el descuento por transferencia nunca se aplique a un pago con tarjeta, para no perder margen.
- **Criterios de aceptación:**
  - [ ] Un hook en el flujo de completar carrito rechaza con `DISCOUNT_PAYMENT_MISMATCH` cualquier carrito con la promoción y un proveedor distinto del manual.
  - [ ] Una prueba automatizada intenta completar un carrito con la promoción y tarjeta, y falla.
  - [ ] El código de la promoción no aparece en ninguna respuesta de la API de tienda.

### E05 · Mercado Pago

#### HU-23 · Acceso seguro del cliente a su pedido
- **Sprint:** S4 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero entrar a mi pedido desde el enlace del email, para ver su estado y subir el comprobante.
- **Criterios de aceptación:**
  - [ ] Al crear el pedido se genera un token aleatorio de al menos 32 bytes. Se guarda solo su hash (SEC-24).
  - [ ] El mismo token sirve varias veces mientras no venza.
  - [ ] Un token inválido devuelve `ORDER_ACCESS_DENIED` sin revelar si el pedido existe.
  - [ ] La comparación se hace en tiempo constante.
  - [ ] La página de confirmación del checkout muestra número de pedido, total, medio de pago y próximos pasos.

#### HU-24 · Pago con tarjeta
- **Sprint:** S4 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero pagar con tarjeta en Mercado Pago, para comprar sin cargar mis datos en la tienda.
- **Criterios de aceptación:**
  - [ ] La preferencia se crea en el backend con el total de Medusa y una referencia externa propia.
  - [ ] Al volver, la página muestra el estado consultado por el backend. Los parámetros de la URL de regreso no cambian estados (SEC-33).
  - [ ] Si Mercado Pago no responde, se muestra `PAYMENT_PROVIDER_UNAVAILABLE` con la opción de pagar por transferencia.
  - [ ] Se cumple la decisión de SP-02 sobre la creación del pedido. Si es la opción A, el stock se verifica al completar y, si falta, el pago se reembolsa y se avisa al cliente.

#### HU-25 · Webhook seguro e idempotente
- **Sprint:** S4 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que los pagos aprobados se registren solos y de forma segura, para no revisarlos a mano ni ser víctima de notificaciones falsas.
- **Criterios de aceptación:**
  - [ ] La firma se valida con HMAC SHA256 sobre `id:[data.id];request-id:[x-request-id];ts:[ts];`, con comparación en tiempo constante (SEC-32).
  - [ ] Notificaciones con `ts` fuera de la ventana permitida se rechazan.
  - [ ] Firma inválida responde `WEBHOOK_SIGNATURE_INVALID` y queda registrada (SEC-95).
  - [ ] El estado se toma siempre de la consulta a la API de Mercado Pago.
  - [ ] Monto, moneda o referencia distintos al pedido no marcan el pago como cobrado y registran `PAYMENT_AMOUNT_MISMATCH`.
  - [ ] Una misma notificación procesada dos veces no duplica pagos ni movimientos de stock.

#### HU-26 · Conciliación de pagos
- **Sprint:** S6 · **Puntos:** 5 · **Prioridad:** Should
- **Descripción:** Como dueño del comercio, quiero que los pagos sin notificación se revisen solos, para no perder ventas si un webhook no llega.
- **Criterios de aceptación:**
  - [ ] Un job del worker revisa los pagos iniciados hace más de 15 minutos sin resolución.
  - [ ] El estado se actualiza solo con la respuesta de la API de Mercado Pago.
  - [ ] Cada ejecución registra cuántos pagos revisó y cuántos cambiaron.

### E06 · Transferencias

#### HU-27 · Pago por transferencia
- **Sprint:** S4 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero pagar por transferencia y ver los datos bancarios, para pagar desde mi banco con descuento.
- **Criterios de aceptación:**
  - [ ] El pedido se crea con el proveedor manual de Medusa y el pago pendiente.
  - [ ] Se muestran titular, CBU o CVU, alias, banco, monto exacto, referencia y fecha de vencimiento.
  - [ ] El stock queda reservado por las reservas nativas.
  - [ ] Un email con pedidos por transferencia pendientes por encima del límite recibe `PENDING_ORDERS_LIMIT` (SEC-40).

#### HU-28 · Subir comprobante
- **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero subir el comprobante de mi transferencia, para que el comercio confirme el pago.
- **Criterios de aceptación:**
  - [ ] Acepta JPG, PNG o PDF de hasta 5 MB, validando el tipo por el contenido (SEC-51).
  - [ ] Errores claros: `TRANSFER_PROOF_TOO_LARGE`, `TRANSFER_PROOF_FORMAT_INVALID`, `TRANSFER_PROOF_PENDING`, `ORDER_EXPIRED`.
  - [ ] El archivo se guarda en el bucket privado con nombre generado y hash SHA-256.
  - [ ] Después de un rechazo, puedo subir otro comprobante.
  - [ ] La página muestra el estado del último comprobante y, si fue rechazado, el motivo.
  - [ ] Límite de 5 subidas por hora por pedido (SEC-17).

#### HU-29 · Revisar comprobantes
- **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero revisar los comprobantes y aceptarlos o rechazarlos, para confirmar los pagos por transferencia.
- **Criterios de aceptación:**
  - [ ] Una extensión del panel muestra la cola de comprobantes en revisión, ordenada por antigüedad.
  - [ ] Veo el comprobante con un enlace firmado de 15 minutos. Los PDF se descargan (SEC-51).
  - [ ] Se marca si el mismo archivo ya se usó en otro pedido (hash repetido).
  - [ ] Aceptar captura el pago con el flujo nativo y el pedido queda pagado.
  - [ ] Rechazar exige un motivo de 10 a 300 caracteres (`REJECTION_REASON_REQUIRED`).
  - [ ] Un comprobante ya revisado no se puede volver a revisar (`TRANSFER_PROOF_NOT_REVIEWABLE`).
  - [ ] El vendedor ve la cola, pero no puede aceptar ni rechazar (`ROLE_NOT_ALLOWED`).

#### HU-30 · Vencimiento de pedidos por transferencia
- **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que los pedidos por transferencia sin pago se cancelen solos, para no tener stock bloqueado.
- **Criterios de aceptación:**
  - [ ] Un job del worker cancela con la cancelación nativa los pedidos sin comprobante aceptado después de `transfer_reservation_hours`.
  - [ ] Un pedido con un comprobante en revisión no se cancela hasta que el admin lo revise.
  - [ ] La cancelación libera el stock reservado.
  - [ ] Cada cancelación automática queda registrada.

#### HU-31 · Datos bancarios y parámetros del comercio
- **Sprint:** S1 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero editar los datos bancarios y los parámetros de transferencia, para mantenerlos actualizados sin ayuda técnica.
- **Criterios de aceptación:**
  - [ ] Una extensión del panel edita las claves de `store.metadata` de `arquitectura.md`, sección 6.
  - [ ] Validaciones de CBU o CVU, alias, horas de reserva y unidades por variante, con `SETTING_INVALID` y el campo señalado.
  - [ ] El código de la promoción de transferencia no se muestra al vendedor.
  - [ ] El vendedor no puede editar estos datos.

### E07 · Pedidos

#### HU-32 · Gestión de pedidos en el panel
- **Sprint:** S6 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero ver y buscar pedidos con su estado de pago y comprobante, para atender a mis clientes.
- **Criterios de aceptación:**
  - [ ] El listado nativo de pedidos permite filtrar por canal y estado de pago.
  - [ ] El detalle del pedido muestra un bloque con el estado del último comprobante y un acceso a él.

#### HU-33 · Cancelar y reembolsar
- **Sprint:** S6 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero cancelar pedidos y registrar reembolsos, para resolver ventas que no se concretan.
- **Criterios de aceptación:**
  - [ ] La cancelación y el reembolso se hacen con las acciones nativas del panel.
  - [ ] Para pagos con Mercado Pago, el reembolso se ejecuta en Mercado Pago si el proveedor elegido en SP-02 lo soporta. Si no, queda documentado el procedimiento manual.
  - [ ] La cancelación libera el stock.

### E08 · Punto de venta

#### HU-34 · Registrar venta en el local
- **Sprint:** S6 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como vendedor, quiero registrar una venta en el local, para que descuente stock y quede registrada.
- **Criterios de aceptación:**
  - [ ] Una ruta del panel, construida con Medusa UI, permite armar la venta con variantes y cantidades.
  - [ ] Medio de pago: efectivo, transferencia o tarjeta.
  - [ ] La venta se crea en el canal "Local", con el pago capturado, y descuenta stock.
  - [ ] Una venta vacía devuelve `SALE_ITEMS_EMPTY`.
  - [ ] Funciona en una pantalla de tablet y con teclado.
- **Bloqueante:** si el efectivo o la transferencia en el local tienen descuento.

#### HU-35 · Buscar productos en el punto de venta
- **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como vendedor, quiero buscar productos por nombre o SKU, para agregarlos rápido.
- **Criterios de aceptación:**
  - [ ] Búsqueda por título y SKU.
  - [ ] Se ven las variantes con su stock disponible.
  - [ ] Una variante sin stock no se puede agregar.

#### HU-36 · Comprobante no fiscal
- **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como vendedor, quiero mostrar o imprimir un comprobante de la venta, para entregárselo al cliente.
- **Criterios de aceptación:**
  - [ ] Dice "Documento no fiscal".
  - [ ] Incluye ítems, total, medio de pago, fecha y número de venta.
  - [ ] Se imprime desde el navegador.

#### HU-37 · Ventas del día
- **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como admin, quiero ver las ventas del local por día, para hacer el cierre de caja.
- **Criterios de aceptación:**
  - [ ] Total por medio de pago para la fecha elegida.
  - [ ] Lista de ventas con hora y usuario.
  - [ ] Solo incluye el canal "Local".

### E09 · Usuarios y roles

#### HU-38 · Usuarios y roles con permisos mínimos
- **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como superadmin, quiero crear usuarios admin y vendedor con permisos acotados, para que cada persona acceda solo a lo que necesita.
- **Criterios de aceptación:**
  - [ ] Se implementa con roles nativos de Medusa o con el guard propio, según SP-01 (SEC-21).
  - [ ] El vendedor solo accede a punto de venta, consulta de productos y stock, y lectura de pedidos y comprobantes.
  - [ ] Cualquier ruta no permitida responde `ROLE_NOT_ALLOWED`. Las rutas nuevas quedan denegadas por defecto.
  - [ ] Hay una prueba automatizada por ruta del admin y por rol.
  - [ ] Solo el superadmin modifica regiones, impuestos, proveedores de pago y claves de API (SEC-22).
  - [ ] Los intentos de acceso denegados quedan registrados (SEC-95).

### E10 · Emails

#### TEC-02 · Proveedor de email
- **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como equipo, quiero el proveedor de email configurado con plantillas base, para que las historias de avisos solo agreguen contenido.
- **Criterios de aceptación:**
  - [ ] Proveedor elegido y configurado en Medusa.
  - [ ] Dominio de envío con SPF, DKIM y DMARC configurados.
  - [ ] Plantilla base con datos del comercio.
  - [ ] Los envíos se hacen desde el worker con reintentos, y los fallos quedan registrados.
- **Bloqueante:** elección del proveedor y dominio.

#### HU-39 · Email de pedido pagado
- **Sprint:** S4 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero un email cuando mi pedido queda pagado, para tener constancia.
- **Criterios de aceptación:**
  - [ ] Se envía al quedar pagado, con tarjeta o con comprobante aceptado.
  - [ ] Incluye número, ítems, total, medio de pago y enlace con token.
  - [ ] No incluye datos que no sean del propio pedido.

#### HU-40 · Email con datos de transferencia
- **Sprint:** S5 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero recibir los datos bancarios por email, para pagar aunque cierre la página.
- **Criterios de aceptación:**
  - [ ] Incluye titular, CBU o CVU, alias, banco, monto exacto, referencia y vencimiento.
  - [ ] Incluye el enlace para subir el comprobante.

#### HU-41 · Aviso al admin por comprobante
- **Sprint:** S5 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero un aviso cuando llega un comprobante, para revisarlo a tiempo.
- **Criterios de aceptación:**
  - [ ] Se envía a `admin_notification_email` con enlace a la cola de revisión.
  - [ ] No incluye el comprobante adjunto ni datos bancarios del cliente.
  - [ ] Un reintento no genera avisos duplicados.

#### HU-42 · Emails de rechazo y cancelación
- **Sprint:** S5 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero saber si rechazaron mi comprobante o se canceló mi pedido, para actuar a tiempo.
- **Criterios de aceptación:**
  - [ ] El rechazo incluye el motivo y el enlace para subir otro comprobante.
  - [ ] La cancelación indica si fue por vencimiento o por el comercio.

### E11 · Seguridad

#### HU-43 · Protección contra abuso
- **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero límites contra pedidos falsos y solicitudes masivas, para que nadie bloquee mi stock ni sature la tienda.
- **Criterios de aceptación:**
  - [ ] Límites de solicitudes por ruta según SEC-17, con `RATE_LIMITED`.
  - [ ] Límites de pedidos pendientes por email e IP según SEC-40, con `PENDING_ORDERS_LIMIT`.
  - [ ] Los valores son configurables sin cambiar código.
  - [ ] Las superaciones de límites quedan registradas (SEC-95).

#### HU-44 · Encabezados y política de contenido
- **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como responsable técnico, quiero una política de seguridad de contenido completa en el storefront, para reducir el impacto de inyecciones.
- **Criterios de aceptación:**
  - [ ] CSP que permite solo el propio dominio, el backend, el dominio de imágenes y Mercado Pago (SEC-60).
  - [ ] Encabezados de SEC-60 presentes en todas las respuestas.
  - [ ] El checkout con Mercado Pago funciona con la política activa.

#### HU-45 · Revisión de seguridad previa al lanzamiento
- **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como responsable técnico, quiero recorrer el checklist de seguridad antes de lanzar, para no salir a producción con riesgos conocidos.
- **Criterios de aceptación:**
  - [ ] Todos los ítems de `seguridad.md`, sección 6, verificados en el entorno de producción.
  - [ ] Los ítems no cumplidos tienen una decisión explícita del Product Owner.
  - [ ] El resultado queda registrado con fecha.

### E12 · Calidad y lanzamiento

#### HU-46 · Pruebas de extremo a extremo
- **Sprint:** S7 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero los flujos críticos probados de punta a punta, para lanzar con confianza.
- **Criterios de aceptación:**
  - [ ] Escenarios automatizados en staging: compra con tarjeta en sandbox, compra por transferencia con aceptación, rechazo y nuevo comprobante, vencimiento, venta en el local, intento de usar el descuento con tarjeta y acceso a un pedido con token inválido.
  - [ ] Reporte adjunto a la versión que sale a producción.

#### HU-47 · Pruebas de concurrencia de stock
- **Sprint:** S7 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero confirmar que las compras simultáneas no venden más de lo que hay, para no quedar mal con clientes.
- **Criterios de aceptación:**
  - [ ] Con 20 compras simultáneas de la última unidad, entre web y local, solo una se concreta.
  - [ ] Ninguna variante queda con stock negativo.
  - [ ] El script de k6 y su resultado quedan guardados.

#### HU-48 · Textos legales
- **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero publicar términos y condiciones y política de privacidad, para informar a mis clientes cómo opera la tienda y qué datos guarda.
- **Criterios de aceptación:**
  - [ ] Ambos textos publicados y enlazados desde el pie de página y el checkout.
  - [ ] Revisados por un profesional, con la revisión registrada.
- **Nota:** el botón de arrepentimiento queda fuera del MVP0 por decisión. Ver riesgos, sección 10.

#### HU-49 · Monitoreo y alertas
- **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como responsable técnico, quiero saber cuándo algo falla, para reaccionar antes de que lo note el cliente.
- **Criterios de aceptación:**
  - [ ] Monitoreo externo de disponibilidad del storefront y del backend.
  - [ ] Alertas de SEC-96 configuradas y probadas.
  - [ ] Los logs no contienen datos personales (SEC-70).

#### HU-50 · Lanzamiento a producción
- **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero la tienda en producción con mi dominio, para empezar a vender.
- **Criterios de aceptación:**
  - [ ] Proyecto de producción en Coolify, separado de staging, con secretos propios.
  - [ ] Dominio y DNS configurados para storefront, backend e imágenes.
  - [ ] Credenciales de Mercado Pago de producción y webhook apuntando a producción.
  - [ ] Configuración base (HU-04) aplicada en producción.
  - [ ] HU-45 completada.
  - [ ] Plan para volver a la versión anterior probado.
- **Bloqueante:** dominio y decisión sobre el botón de arrepentimiento antes de abrir al público.

---

## 8. Preguntas bloqueantes

| # | Pregunta | Afecta a | Necesaria antes de |
|---|---|---|---|
| 1 | Condición fiscal del cliente | HU-04 | S1 |
| 2 | ¿Un producto puede estar en más de una subcategoría? | HU-07 | S1 |
| 3 | Dominio del comercio | HU-05 (producción), TEC-02, HU-50 | S3 |
| 4 | Proveedor de email | TEC-02 | S3 |
| 5 | ¿El efectivo o la transferencia en el local tienen descuento? | HU-34 | S6 |
| 6 | Botón de arrepentimiento antes de abrir al público | HU-50 | S7 |

## 9. Plan de sprints

| Sprint | Objetivo | Tickets | Puntos |
|---|---|---|---|
| **S0** · Fundación | Entorno local, servidor seguro, staging y verificación técnica | HU-01, HU-02, HU-03, HU-05, TEC-01, SP-01 | 24 |
| **S1** · Configuración y catálogo | Medusa configurado, roles activos y catálogo cargable | HU-04, HU-07, HU-08, HU-09, HU-10, HU-11, HU-31, HU-38 | 28 |
| **S2** · Tienda | El cliente ve y elige productos. Decisión de Mercado Pago. | HU-12, HU-13, HU-14, HU-15, HU-16, SP-02 | 32 |
| **S3** · Checkout | Pedido completo con envío y medio de pago | HU-17, HU-18, HU-19, HU-20, HU-21, HU-22, TEC-02 | 31 |
| **S4** · Pagos | Tarjeta, inicio de transferencias y acceso al pedido | HU-23, HU-24, HU-25, HU-27, HU-39 | 27 |
| **S5** · Transferencias | Comprobantes, vencimientos, avisos, abuso y respaldos | HU-06, HU-28, HU-29, HU-30, HU-40, HU-41, HU-42, HU-43 | 29 |
| **S6** · Local y pedidos | Punto de venta, gestión de pedidos, conciliación y CSP | HU-26, HU-32, HU-33, HU-34, HU-35, HU-36, HU-37, HU-44 | 29 |
| **S7** · Lanzamiento | Pruebas, legales, monitoreo, seguridad y producción | HU-45, HU-46, HU-47, HU-48, HU-49, HU-50 | 25 |

**Total:** 225 puntos en 8 sprints (16 semanas), con el supuesto de capacidad de la sección 2.

**Criterios del orden:**
- Los roles (HU-38) se implementan en el mismo sprint en que se pueden crear usuarios. Nunca hay vendedores sin restricciones.
- El proveedor de email (TEC-02) llega antes que cualquier historia que envía emails.
- SP-01 y SP-02 van antes de las historias que dependen de sus respuestas.
- Si SP-02 concluye que hace falta un proveedor propio de Mercado Pago, HU-24 y HU-25 pueden pasar de S4 a S5, y HU-28 a HU-30 se adelantan a S4.

## 10. Riesgos del plan

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Botón de arrepentimiento ausente al abrir al público** | Alta, si no se agrega | Alto: incumplimiento legal | Fuera del MVP0 por decisión. HU-50 lo marca como bloqueante para abrir al público. Recomendación: incorporarlo como primera historia del MVP1 o antes del lanzamiento. |
| SP-01 encuentra que una pieza nativa no existe | Media | Medio | Cada punto **[Verificar]** tiene una alternativa propia documentada. Se reestima el sprint afectado. |
| El plugin de Mercado Pago no es confiable | Media | Alto | SP-02 en S2 deja tiempo para un proveedor propio. |
| Capacidad real distinta de 30 puntos | Alta | Medio | Recalibrar después de S1 y mover historias Should. |
| Preguntas bloqueantes sin respuesta | Media | Medio | Revisarlas en cada planificación. Las de S1 deben estar resueltas antes de empezar. |
| Vulnerabilidad crítica en Coolify, Next.js o Medusa | Media | Alto | SEC-03, SEC-62, SEC-80 y revisión semanal de avisos. |
| Falla del servidor sin respaldo | Baja | Alto | HU-06 en S5. No se lanza sin restauración probada. |

## 11. Ceremonias

| Ceremonia | Frecuencia | Duración | Propósito |
|---|---|---|---|
| Planificación | Inicio de sprint | 1 hora | Objetivo, historias y preguntas bloqueantes. |
| Daily | Diaria | 15 minutos | Avance, siguiente paso y bloqueos. |
| Refinamiento | Semanal | 1 hora | Estimar, dividir y resolver dudas. |
| Revisión | Fin de sprint | 45 minutos | Demo al dueño del comercio. |
| Retrospectiva | Fin de sprint | 30 minutos | Una mejora concreta por sprint. |

## 12. Métricas

| Métrica | Uso |
|---|---|
| Velocidad | Calibrar la capacidad. |
| Tiempo de ciclo | Detectar historias trabadas. |
| Throughput | Confirmar un flujo estable. |
| Trabajo en curso | Respetar los límites del tablero. |
| Bugs después de "Hecha" | Medir la calidad de criterios y pruebas. |

## 13. Convenciones

- IDs estables: `HU-XX`, `TEC-XX`, `SP-XX`, `BUG-XX`. El número no cambia con la prioridad.
- Ramas: `feature/HU-XX-descripcion`, `fix/BUG-XX-descripcion`.
- Commits: conventional commits con el detalle en español, por ejemplo `feat: se agrega filtro por subcategoría`. El ID de la historia va en la rama y en el título del pull request, no en el commit.
- Pull requests: título con el ID y enlace al ticket.

## 14. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión. |
| 2026-10-23 | 2 | Backlog rehecho sobre lo nativo de Medusa: 50 historias, 2 tareas técnicas y 2 spikes (225 puntos). Se agregan configuración base, endurecimiento del servidor, épica de seguridad, monitoreo y lanzamiento. Se eliminan la máquina de estados propia, la entidad de pagos por transferencia, el bloqueo de cuentas y la revocación de tokens. Roles junto con la creación de usuarios, emails antes de las historias que los usan y nueva Definition of Done previa al lanzamiento. Todo en Coolify. |
| 2026-10-23 | 2.1 | Convención de commits: conventional commits con el detalle en español. |
