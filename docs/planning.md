# Planificación del MVP0: Tienda online + punto de venta

**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `producto.md` (qué construimos), `arquitectura.md` (cómo lo construimos)

---

## 1. Objetivo de la planificación

Organizar el trabajo del MVP0 en épicas, historias de usuario y tareas técnicas, con criterios de aceptación verificables, y repartirlo en sprints con un objetivo claro por cada uno.

Este documento no reemplaza el backlog de la herramienta de gestión elegida (Jira, Linear, GitHub Projects o Trello). Sirve como fuente inicial para cargar esos tickets, y debe mantenerse sincronizado con ellos.

## 2. Metodología: Scrum con tablero Kanban

Usamos **Scrum** para la cadencia (sprints, planificación, revisión y retrospectiva) y **Kanban** para la gestión del flujo diario (tablero, límites de trabajo en curso y métricas de tiempo de ciclo).

**Por qué esta combinación:**

- El equipo es pequeño y el trabajo llega en bloques de dependencias (infraestructura antes que catálogo, catálogo antes que tienda, tienda antes que pagos). Scrum ayuda a comprometer un objetivo por sprint.
- Algunas tareas aparecen en medio del sprint, como bugs o pruebas con el cliente. Kanban permite absorberlas sin romper el compromiso, siempre que respeten los límites de trabajo en curso.
- No hay un cliente externo que requiera informes de velocidad. Las métricas de flujo (tiempo de ciclo y throughput) nos dicen mejor dónde se traba el trabajo.

**Parámetros:**

| Parámetro | Valor |
|---|---|
| Duración del sprint | 2 semanas |
| Capacidad asumida | 35 puntos por sprint (a validar después del Sprint 1) |
| Escala de estimación | Fibonacci: 1, 2, 3, 5, 8 |
| Máximo de historias de 8 puntos | Se dividen si superan ese tamaño |

## 3. Roles

| Rol | Persona | Responsabilidad |
|---|---|---|
| **Product Owner** | Definido con el dueño del comercio | Prioriza el backlog, acepta o rechaza historias, responde dudas de negocio. |
| **Scrum Master / facilitador** | Quien lidere el proyecto | Conduce las ceremonias, elimina bloqueos y cuida los límites de trabajo en curso. |
| **Equipo de desarrollo** | Desarrolladores del proyecto | Estima, desarrolla, prueba y entrega. Se auto-organiza dentro del sprint. |
| **Cliente (dueño del comercio)** | Dueño del local | Revisa las demos y valida la operación real. No modifica el sprint en curso. |

En un equipo de una o dos personas, un mismo integrante puede ocupar varios roles. Lo que no debe cambiar es la separación entre aceptar una historia (rol de Product Owner) y desarrollarla.

## 4. Tablero Kanban

### 4.1 Columnas

| Columna | Qué significa | Límite de trabajo en curso (WIP) |
|---|---|---|
| **Backlog** | Historia descrita pero no priorizada para el sprint actual. | — |
| **Listo para desarrollo** | Cumple la Definition of Ready (sección 5). | — |
| **En progreso** | Alguien está desarrollándola. | 2 por persona |
| **En revisión** | Pull request abierto, esperando code review. | 3 en total |
| **En pruebas** | Desplegada en staging, esperando validación funcional. | 3 en total |
| **Aceptada** | Validada por el Product Owner. Lista para producción. | — |
| **Hecha** | Desplegada en producción y verificada. | — |

Si una columna está llena, no se empieza nada nuevo. Primero se destraba lo que está en esa columna.

### 4.2 Tipos de ticket

| Tipo | Uso | Ejemplo |
|---|---|---|
| **HU** (historia de usuario) | Funcionalidad visible para un usuario. | HU-14 Listado de productos |
| **TEC** (tarea técnica) | Trabajo necesario sin valor directo para el usuario. | TEC-01 Configurar CI |
| **SP** (spike) | Investigación con un entregable escrito, para decidir. | SP-01 Evaluar plugin de Mercado Pago |
| **BUG** | Defecto encontrado en una historia ya aceptada. | BUG-03 Precio por transferencia mal redondeado |

Los bugs de historias del sprint actual se resuelven dentro del sprint. Los bugs de historias ya entregadas entran al backlog y se priorizan con el resto.

## 5. Definition of Ready y Definition of Done

### 5.1 Definition of Ready (para entrar a "Listo para desarrollo")

Una historia puede empezar cuando cumple todo lo siguiente:

- [ ] Tiene descripción en formato "Como [rol], quiero [acción], para [beneficio]".
- [ ] Tiene criterios de aceptación verificables.
- [ ] Tiene puntos estimados por el equipo.
- [ ] Sus dependencias están resueltas o planificadas en un sprint anterior.
- [ ] Las preguntas abiertas que la bloquean están respondidas por el Product Owner.
- [ ] Tiene referencia a la sección de `arquitectura.md` que la respalda, si aplica.

### 5.2 Definition of Done (para entrar a "Hecha")

Una historia está hecha cuando cumple todo lo siguiente:

- [ ] Todos sus criterios de aceptación están cumplidos y verificados.
- [ ] El código pasa lint, tests y build en CI.
- [ ] Tiene tests automatizados para la lógica de negocio y los endpoints nuevos.
- [ ] Fue revisado por al menos otra persona, o por el propio desarrollador con una lista de revisión si el equipo es de una sola persona.
- [ ] Está desplegada en staging y fue probada allí.
- [ ] Los errores nuevos tienen código del catálogo de la arquitectura (sección 10).
- [ ] El Product Owner la aceptó.
- [ ] La documentación afectada se actualizó (`producto.md`, `arquitectura.md` o este documento).

## 6. Épicas

| ID | Épica | Objetivo | Historias |
|---|---|---|---|
| E01 | Infraestructura y base | Entorno reproducible, despliegue y operación básica | HU-01 a HU-05, SP-02 |
| E02 | Configuración de la tienda | El dueño configura la tienda sin ayuda técnica | HU-06 |
| E03 | Catálogo en el admin | Crear categorías, opciones, productos y stock | HU-07 a HU-12 |
| E04 | Tienda online | Ver y elegir productos | HU-13 a HU-17 |
| E05 | Carrito y checkout | Comprar como invitado, elegir envío y medio de pago | HU-18 a HU-23 |
| E06 | Pagos con Mercado Pago | Pago con tarjeta confiable y conciliado | HU-24 a HU-26, SP-01 |
| E07 | Transferencias | Pago por transferencia con comprobante y verificación | HU-27 a HU-32 |
| E08 | Pedidos | Estados, seguimiento y cancelaciones | HU-33 a HU-36 |
| E09 | Punto de venta local | Vender en el local con stock compartido | HU-37 a HU-40 |
| E10 | Stock | Ajustes controlados y sin sobreventa | HU-41, HU-42 |
| E11 | Usuarios y roles | Acceso por perfil y seguridad del panel | HU-43 a HU-45 |
| E12 | Notificaciones por email | Avisar a clientes y dueño en cada paso | HU-46 a HU-49 |
| E13 | Calidad y lanzamiento | Pruebas de extremo a extremo, textos legales y CI | HU-50, HU-51, TEC-01, TEC-02 |

---

## 7. Historias de usuario

Cada historia incluye: épica, sprint asignado, puntos, descripción, criterios de aceptación y notas técnicas. Los criterios se escriben como condiciones verificables. Cuando la historia depende de una pregunta abierta, aparece como **Bloqueante**.

### E01 · Infraestructura y base

#### HU-01 · Entorno de desarrollo reproducible
- **Épica:** E01 · **Sprint:** S0 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como equipo de desarrollo, quiero un monorepo con entorno Docker local, para levantar el sistema completo con un solo comando.
- **Criterios de aceptación:**
  - [ ] `docker compose up` levanta PostgreSQL, Redis y el backend en una máquina limpia.
  - [ ] Los healthchecks de PostgreSQL y Redis están en verde antes de que arranque el backend.
  - [ ] Existe `.env.example` con todas las variables de `arquitectura.md`, sección 5.2, y el repositorio no contiene credenciales reales.
  - [ ] El README explica cómo levantar, detener y reiniciar el entorno limpio.
- **Notas técnicas:** `arquitectura.md`, secciones 4, 5.2 y 17.

#### HU-02 · Staging en Coolify
- **Épica:** E01 · **Sprint:** S0 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del proyecto, quiero un entorno de staging desplegado en Coolify, para revisar los cambios antes de producción.
- **Criterios de aceptación:**
  - [ ] Backend, worker, PostgreSQL y Redis corren como servicios separados dentro de un mismo proyecto.
  - [ ] El acceso es por HTTPS con certificado válido.
  - [ ] Un nuevo despliegue actualiza el backend sin borrar datos de la base.
  - [ ] Las variables sensibles están cargadas como secretos en Coolify.
- **Notas técnicas:** `arquitectura.md`, secciones 17 y 12. Confirmar el modo de arranque de worker y backend en la documentación de Medusa (SP-02).

#### HU-03 · Imágenes de producto en R2
- **Épica:** E01 · **Sprint:** S0 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero subir imágenes de producto que queden disponibles públicamente, para mostrarlas en la tienda.
- **Criterios de aceptación:**
  - [ ] Subir una imagen JPG, PNG o WebP devuelve una URL bajo el dominio `S3_FILE_URL`.
  - [ ] Un archivo mayor a 5 MB o de otro formato se rechaza con un mensaje que indica el límite y los formatos válidos.
  - [ ] El bucket de productos no contiene comprobantes ni archivos privados.
- **Notas técnicas:** `arquitectura.md`, sección 11.2. Proveedor oficial `file-s3` de Medusa.

#### HU-04 · Comprobantes en almacenamiento privado
- **Épica:** E01 · **Sprint:** S4 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que los comprobantes de transferencia queden en un almacenamiento privado, para proteger los datos bancarios y personales de mis clientes.
- **Criterios de aceptación:**
  - [ ] Ninguna URL pública da acceso a un comprobante.
  - [ ] El acceso se da solo con un enlace firmado que vence a los 15 minutos.
  - [ ] La clave del archivo en el storage es un identificador generado, no el nombre original.
  - [ ] El sistema valida el tipo MIME real del archivo, no solo la extensión.
- **Notas técnicas:** `arquitectura.md`, sección 11.3. Módulo propio con SDK de S3 directo contra R2.

#### HU-05 · Copias de seguridad de la base de datos
- **Épica:** E01 · **Sprint:** S5 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero copias diarias de la base de datos en un almacenamiento externo, para recuperar pedidos y stock si la VPS falla.
- **Criterios de aceptación:**
  - [ ] Hay un respaldo diario de PostgreSQL almacenado fuera de la VPS.
  - [ ] La retención está definida (por ejemplo, 30 días) y documentada.
  - [ ] Se realizó una restauración de prueba en staging y quedó registrada.
- **Notas técnicas:** `arquitectura.md`, sección 17.

### E02 · Configuración de la tienda

#### HU-06 · Configurar parámetros de la tienda
- **Épica:** E02 · **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero configurar el descuento por transferencia, los datos bancarios, el costo de envío, el tiempo de reserva y el email de avisos, para ajustar la tienda sin pedir ayuda técnica.
- **Criterios de aceptación:**
  - [ ] El porcentaje de descuento acepta valores entre 0 y 100, con hasta dos decimales.
  - [ ] El CBU o CVU valida 22 dígitos, y el alias valida entre 6 y 20 caracteres.
  - [ ] Un valor inválido muestra `SETTING_INVALID` y señala el campo con error.
  - [ ] Cada cambio guarda quién lo hizo y cuándo.
  - [ ] Un vendedor no puede ver ni modificar esta configuración.
- **Notas técnicas:** `arquitectura.md`, secciones 5.1 y 9.4.

### E03 · Catálogo en el admin

#### HU-07 · Gestionar categorías en tres niveles
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero crear rubros, categorías y subcategorías, para organizar el catálogo de la tienda.
- **Criterios de aceptación:**
  - [ ] Puedo crear, renombrar y reordenar categorías en tres niveles: rubro, categoría y subcategoría.
  - [ ] No puedo crear una subcategoría sin categoría padre.
  - [ ] Una categoría con productos publicados no se elimina; se puede desactivar.
  - [ ] Ninguna categoría viene cargada por defecto.
- **Bloqueante:** Confirmar si un producto puede estar en más de una subcategoría. Hasta confirmar, la interfaz permite solo una.
- **Notas técnicas:** `arquitectura.md`, sección 6.3.

#### HU-08 · Crear talles y colores propios
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero crear mis propios talles y colores con muestra visual, para usarlos en mis productos.
- **Criterios de aceptación:**
  - [ ] Ningún talle ni color viene cargado por defecto.
  - [ ] Puedo crear una opción (por ejemplo, "Talle") con los valores que defino, en el orden que elijo.
  - [ ] Un color requiere nombre y muestra en formato `#RRGGBB`.
  - [ ] El sistema no permite valores repetidos dentro de una misma opción.
- **Notas técnicas:** `arquitectura.md`, sección 6.2 (`ProductColor`). Las opciones de Medusa se definen por producto.

#### HU-09 · Crear producto
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero crear un producto con título, descripción, categoría, precio de lista e imágenes, para publicarlo en la tienda.
- **Criterios de aceptación:**
  - [ ] Título y precio de lista son obligatorios. Descripción, categoría e imágenes son opcionales.
  - [ ] El precio de lista es mayor que cero.
  - [ ] Puedo subir varias imágenes y cambiar su orden.
  - [ ] El producto se guarda como borrador por defecto.
- **Notas técnicas:** Depende de HU-03 y HU-07.

#### HU-10 · Generar variantes y cargar stock
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero generar las variantes de un producto a partir de sus talles y colores, y cargar el stock de cada una, para vender cada combinación con su propio inventario.
- **Criterios de aceptación:**
  - [ ] Al elegir opciones, el sistema propone todas las combinaciones posibles.
  - [ ] No se pueden crear dos variantes con la misma combinación.
  - [ ] Cada variante tiene un stock inicial igual o mayor que cero.
  - [ ] Una variante con stock cero aparece como agotada en la tienda.
- **Notas técnicas:** Depende de HU-08 y HU-09.

#### HU-11 · Publicar y despublicar productos
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero publicar o despublicar productos, para controlar qué aparece en la tienda.
- **Criterios de aceptación:**
  - [ ] Solo los productos publicados aparecen en la tienda.
  - [ ] Un producto sin precio o sin variantes no se puede publicar, y el sistema explica por qué.
  - [ ] Un producto con pedidos no se elimina. Al despublicarlo, los pedidos históricos siguen mostrándolo.
- **Notas técnicas:** Depende de HU-10.

#### HU-12 · Desactivar en lugar de eliminar
- **Épica:** E03 · **Sprint:** S1 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero desactivar talles, colores y categorías que ya usé, para dejar de ofrecerlos sin perder el historial.
- **Criterios de aceptación:**
  - [ ] Un valor desactivado no aparece al cargar productos nuevos ni en la tienda.
  - [ ] Los pedidos existentes siguen mostrando el valor original.
  - [ ] Puedo reactivar un valor desactivado.
- **Notas técnicas:** `arquitectura.md`, sección 6.3.

### E04 · Tienda online

#### HU-13 · Base del storefront
- **Épica:** E04 · **Sprint:** S2 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como equipo de desarrollo, quiero un storefront base con Next.js 16.4.3, Tailwind CSS, shadcn/ui, Phosphor Icons, Zustand, TanStack Query y Storybook, para construir la interfaz con componentes documentados.
- **Criterios de aceptación:**
  - [ ] La versión de Next.js está fijada en 16.4.3 en `package.json`, sin prefijo `^`.
  - [ ] Storybook muestra al menos los componentes Botón, Tarjeta de producto y Selector de variantes.
  - [ ] La clave publicable de Medusa se lee desde variables de entorno.
  - [ ] Lint y build pasan en CI.
- **Notas técnicas:** `arquitectura.md`, sección 2.

#### HU-14 · Listado de productos
- **Épica:** E04 · **Sprint:** S2 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver el catálogo, filtrarlo por categoría y buscar por texto, para encontrar productos rápido.
- **Criterios de aceptación:**
  - [ ] Solo aparecen productos publicados.
  - [ ] Puedo filtrar por categoría y subcategoría, y buscar por título.
  - [ ] Los resultados se paginan con un límite por página.
  - [ ] Los filtros se reflejan en la URL, para compartir o volver atrás.
- **Notas técnicas:** Depende de HU-11 y HU-13.

#### HU-15 · Detalle de producto con selección de variante
- **Épica:** E04 · **Sprint:** S2 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir talle y color en la ficha del producto, para comprar exactamente la variante que necesito.
- **Criterios de aceptación:**
  - [ ] Solo puedo elegir combinaciones que existen como variante.
  - [ ] Una variante agotada aparece marcada y no se puede agregar al carrito.
  - [ ] La ficha muestra el precio de lista y, si aplica, el precio por transferencia (HU-16).
  - [ ] Si el producto no tiene imagen, muestra un marcador visual y no una imagen rota.
- **Notas técnicas:** Depende de HU-10 y HU-13.

#### HU-16 · Mostrar precio por transferencia
- **Épica:** E04 · **Sprint:** S2 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver el precio por transferencia antes de elegir el medio de pago, para decidir sin sorpresas.
- **Criterios de aceptación:**
  - [ ] Se muestra el precio de lista tachado y el precio por transferencia, con el porcentaje de descuento.
  - [ ] El precio coincide con el que calcula el backend para el mismo producto y la misma variante.
  - [ ] El redondeo es al entero más cercano.
  - [ ] Si el porcentaje es cero, no se muestra el precio por transferencia.
- **Notas técnicas:** `arquitectura.md`, sección 7.2. Depende de HU-06.

#### HU-17 · Estados de carga, vacío y error
- **Épica:** E04 · **Sprint:** S2 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver mensajes claros mientras carga, cuando no hay resultados o cuando algo falla, para entender qué pasa en cada pantalla.
- **Criterios de aceptación:**
  - [ ] El listado y el detalle muestran un esqueleto de carga mientras esperan datos.
  - [ ] Sin resultados, se muestra un mensaje y un botón para limpiar los filtros.
  - [ ] Ante un error de red, se muestra un mensaje y un botón para reintentar.

### E05 · Carrito y checkout

#### HU-18 · Carrito persistente
- **Épica:** E05 · **Sprint:** S2 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero agregar productos al carrito y que se mantengan al recargar la página, para no perder lo que elegí.
- **Criterios de aceptación:**
  - [ ] Puedo agregar, quitar y cambiar la cantidad de cada variante.
  - [ ] El carrito se mantiene al recargar la página en el mismo navegador.
  - [ ] El subtotal se muestra con el precio de lista.
- **Notas técnicas:** Carrito de Medusa vinculado a la sesión del navegador. Zustand para el estado local y TanStack Query para sincronizar con la API.

#### HU-19 · Validar stock en el carrito
- **Épica:** E05 · **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero saber si una variante no tiene stock suficiente, para no intentar comprar algo agotado.
- **Criterios de aceptación:**
  - [ ] Si pido más unidades que el stock disponible, se muestra `STOCK_INSUFFICIENT` con la cantidad disponible.
  - [ ] Si una variante se desactiva mientras está en el carrito, se quita con un aviso (`VARIANT_INACTIVE`).
- **Notas técnicas:** Depende de HU-18.

#### HU-20 · Checkout como invitado
- **Épica:** E05 · **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero comprar sin crear una cuenta, para completar la compra rápido.
- **Criterios de aceptación:**
  - [ ] Nombre, email y teléfono son obligatorios. El documento es opcional.
  - [ ] El email se valida con formato correcto.
  - [ ] No se pide contraseña.
  - [ ] Los datos quedan asociados al pedido.
- **Notas técnicas:** Depende de HU-18.

#### HU-21 · Elegir envío o retiro
- **Épica:** E05 · **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir entre retirar en el local o recibir por envío con costo fijo, para recibir mi compra como prefiero.
- **Criterios de aceptación:**
  - [ ] El retiro en el local no tiene costo.
  - [ ] El envío suma el costo fijo configurado.
  - [ ] El pedido muestra el método elegido para que el dueño lo coordine. El sistema no genera guías de envío.
- **Notas técnicas:** Opciones de envío nativas de Medusa. Depende de HU-06.

#### HU-22 · Elegir medio de pago y ver el total
- **Épica:** E05 · **Sprint:** S3 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero elegir entre tarjeta y transferencia y ver el total actualizado, para saber cuánto voy a pagar.
- **Criterios de aceptación:**
  - [ ] Con tarjeta, el total usa el precio de lista.
  - [ ] Con transferencia, el total aplica el descuento configurado.
  - [ ] Al cambiar el medio, el total se recalcula antes de confirmar.
  - [ ] No puedo confirmar sin haber elegido un medio de pago.
- **Notas técnicas:** La promoción de transferencia se aplica y quita del carrito según el medio (HU-32). Verificar en Medusa 2.22 que la sesión de pago se reinicie al cambiar el total (SP-02).

#### HU-23 · Pantalla de confirmación
- **Épica:** E05 · **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver una pantalla de confirmación con el número de pedido, para hacer seguimiento.
- **Criterios de aceptación:**
  - [ ] Muestra número de pedido, total, medio de pago y próximos pasos.
  - [ ] El acceso usa el token del pedido. Sin token válido no se muestra ningún dato.
  - [ ] El número coincide con el del email de confirmación.
- **Notas técnicas:** `arquitectura.md`, sección 12.3.

### E06 · Pagos con Mercado Pago

#### SP-01 · Evaluar plugin de Mercado Pago o proveedor propio
- **Épica:** E06 · **Sprint:** S3 · **Puntos:** 3 · **Prioridad:** Must · **Tipo:** Spike
- **Descripción:** Como equipo de desarrollo, quiero comparar los plugins de Mercado Pago para Medusa y decidir si usamos uno o desarrollamos un proveedor propio, para evitar depender de un paquete sin mantenimiento.
- **Criterios de aceptación:**
  - [ ] Informe con los criterios de `arquitectura.md`, sección 14.3, aplicados a cada plugin encontrado.
  - [ ] Verificación de compatibilidad con Medusa 2.22 y con webhooks firmados.
  - [ ] Decisión registrada en el documento de arquitectura.
- **Notas técnicas:** Entregable: documento de decisión, no código de producción.

#### HU-24 · Pagar con tarjeta en Mercado Pago
- **Épica:** E06 · **Sprint:** S4 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero pagar con tarjeta a través de Mercado Pago, para comprar sin cargar mis datos de tarjeta en la tienda.
- **Criterios de aceptación:**
  - [ ] El cliente es redirigido a Checkout Pro con el total de precio de lista.
  - [ ] Al volver a la tienda, el estado mostrado proviene de la consulta a Mercado Pago, no de los datos del navegador.
  - [ ] Si Mercado Pago no responde, se muestra `PAYMENT_PROVIDER_UNAVAILABLE` con la opción de pagar por transferencia.
  - [ ] Los datos de tarjeta nunca pasan por el servidor de la tienda.
- **Notas técnicas:** `arquitectura.md`, sección 14. Depende de SP-01.

#### HU-25 · Confirmar pagos por webhook
- **Épica:** E06 · **Sprint:** S4 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que los pagos aprobados se registren automáticamente, para no revisarlos a mano.
- **Criterios de aceptación:**
  - [ ] Una notificación sin firma válida devuelve `WEBHOOK_SIGNATURE_INVALID` y no cambia ningún dato.
  - [ ] Recibir dos veces la misma notificación no duplica el pago ni descuenta el stock dos veces.
  - [ ] Un pago aprobado marca el pedido como Pagado.
  - [ ] Cada notificación procesada queda registrada.
- **Notas técnicas:** El estado se confirma con una consulta directa a la API de Mercado Pago, nunca solo con el contenido de la notificación.

#### HU-26 · Conciliar pagos pendientes
- **Épica:** E06 · **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Should
- **Descripción:** Como dueño del comercio, quiero que los pagos pendientes se revisen de forma periódica, para no perder pagos cuya notificación nunca llegó.
- **Criterios de aceptación:**
  - [ ] Un job revisa los pagos pendientes de más de 15 minutos. El intervalo es configurable.
  - [ ] El estado se actualiza solo con la respuesta de la API de Mercado Pago.
  - [ ] Cada ejecución registra cuántos pagos revisó y cuántos cambiaron de estado.

### E07 · Transferencias

#### HU-27 · Iniciar pago por transferencia
- **Épica:** E07 · **Sprint:** S4 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero ver los datos bancarios y una referencia al elegir transferencia, para pagar desde mi banco.
- **Criterios de aceptación:**
  - [ ] Muestra titular, CBU o CVU, alias, banco, monto exacto y referencia (número de pedido).
  - [ ] Muestra la fecha y hora de vencimiento de la reserva de stock.
  - [ ] El pedido queda en estado "Pendiente de pago".
- **Notas técnicas:** Proveedor de pago propio de tipo manual. `arquitectura.md`, sección 9.1.

#### HU-28 · Reservar stock con vencimiento
- **Épica:** E07 · **Sprint:** S4 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que el stock de un pedido por transferencia quede reservado por un tiempo, para no vender dos veces el mismo producto.
- **Criterios de aceptación:**
  - [ ] La reserva dura el tiempo configurado en `reservation_ttl_hours`, con 48 horas por defecto.
  - [ ] Si la reserva vence sin comprobante, el pedido se cancela y el stock vuelve a estar disponible.
  - [ ] Un pedido con comprobante en revisión conserva su reserva hasta que el admin decida.
- **Notas técnicas:** Job de vencimiento. Depende de HU-06.

#### HU-29 · Subir comprobante de transferencia
- **Épica:** E07 · **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero subir una foto o un PDF del comprobante, para que el dueño confirme mi pago.
- **Criterios de aceptación:**
  - [ ] Acepta JPG, PNG y PDF de hasta 5 MB.
  - [ ] Si supera el tamaño, muestra `TRANSFER_PROOF_TOO_LARGE`. Si el formato no es válido, muestra `TRANSFER_PROOF_FORMAT_INVALID`.
  - [ ] Después de subirlo, el pedido pasa a "Comprobante recibido".
  - [ ] Si ya hay un comprobante en revisión, muestra `TRANSFER_PROOF_ALREADY_SUBMITTED`.
  - [ ] Después de un rechazo, el cliente puede subir un comprobante nuevo.
- **Notas técnicas:** Depende de HU-04 y HU-27.

#### HU-30 · Ver cola de transferencias
- **Épica:** E07 · **Sprint:** S5 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero ver las transferencias pendientes de revisión, para atenderlas en orden.
- **Criterios de aceptación:**
  - [ ] Puedo filtrar por estado.
  - [ ] Las transferencias aparecen ordenadas por antigüedad del comprobante.
  - [ ] El vendedor puede ver la cola, pero no confirmar ni rechazar.
- **Notas técnicas:** Depende de HU-29.

#### HU-31 · Confirmar o rechazar transferencia
- **Épica:** E07 · **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero confirmar o rechazar cada comprobante, para que el pedido avance o se corrija.
- **Criterios de aceptación:**
  - [ ] Confirmar marca el pedido como Pagado y envía el email correspondiente.
  - [ ] Rechazar exige un motivo de entre 10 y 300 caracteres. Sin motivo válido muestra `REJECTION_REASON_REQUIRED`.
  - [ ] Un rechazo devuelve el pedido a "Pendiente de pago" y muestra el motivo al cliente.
  - [ ] Un comprobante ya revisado no se puede volver a revisar (`TRANSFER_NOT_REVIEWABLE`).
- **Notas técnicas:** Depende de HU-30 y HU-47.

#### HU-32 · Descuento solo con transferencia
- **Épica:** E07 · **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que el descuento por transferencia solo se aplique con ese medio de pago, para no perder margen en pagos con tarjeta.
- **Criterios de aceptación:**
  - [ ] Con tarjeta, el total siempre usa el precio de lista.
  - [ ] Si el pedido llega con el descuento de transferencia y otro medio de pago, el backend responde `DISCOUNT_PAYMENT_MISMATCH` y no completa el pedido.
  - [ ] La promoción se aplica automáticamente. El cliente no ingresa ningún código.
  - [ ] Cambiar el porcentaje en la configuración actualiza la promoción.
- **Notas técnicas:** Hook de validación en el flujo de completar carrito. `arquitectura.md`, sección 7.

### E08 · Pedidos

#### HU-33 · Estados de pedido
- **Épica:** E08 · **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como equipo de desarrollo, quiero estados y transiciones definidos, para que ningún pedido quede en un estado imposible.
- **Criterios de aceptación:**
  - [ ] Solo se permiten las transiciones de `producto.md`, sección 8.5.
  - [ ] Una transición inválida devuelve un error y no cambia el pedido.
  - [ ] Cada cambio de estado registra fecha y origen (usuario o sistema).
- **Notas técnicas:** Pruebas unitarias sobre la máquina de estados.

#### HU-34 · Listado y detalle de pedidos en el admin
- **Épica:** E08 · **Sprint:** S5 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero ver y buscar pedidos, para atender a mis clientes.
- **Criterios de aceptación:**
  - [ ] Puedo filtrar por estado, medio de pago y rango de fechas.
  - [ ] Puedo buscar por número de pedido o por email.
  - [ ] El detalle muestra ítems, total, medio de pago, método de envío, datos del cliente e historial de estados.

#### HU-35 · Cancelar pedido
- **Épica:** E08 · **Sprint:** S5 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero cancelar un pedido, para liberar el stock cuando la venta no se concreta.
- **Criterios de aceptación:**
  - [ ] Solo se pueden cancelar pedidos en "Pendiente de pago" o "Comprobante recibido".
  - [ ] El stock reservado vuelve a estar disponible.
  - [ ] La cancelación exige un motivo.
  - [ ] El cliente recibe un email con la cancelación.

#### HU-36 · Registrar reembolso
- **Épica:** E08 · **Sprint:** S5 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como admin, quiero registrar un reembolso, para dejar constancia cuando devuelvo dinero al cliente.
- **Criterios de aceptación:**
  - [ ] Solo se puede registrar un reembolso sobre pedidos pagados.
  - [ ] El monto no supera lo pagado.
  - [ ] El pedido pasa al estado "Reembolsado".
  - [ ] Para pagos con tarjeta, el reembolso se ejecuta en Mercado Pago. El sistema solo lo registra.

### E09 · Punto de venta local

#### HU-37 · Registrar venta en el local
- **Épica:** E09 · **Sprint:** S6 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como vendedor, quiero registrar una venta en el local con sus productos y medio de pago, para que quede registrada y descuente el stock.
- **Criterios de aceptación:**
  - [ ] Puedo agregar variantes con cantidad.
  - [ ] El medio de pago puede ser efectivo, transferencia o tarjeta.
  - [ ] Confirmar la venta descuenta el stock de las variantes exactas vendidas.
  - [ ] Una venta sin productos muestra `SALE_ITEMS_EMPTY`.
  - [ ] El total usa el precio de lista. **Bloqueante:** confirmar si efectivo y transferencia en el local tienen descuento.
- **Notas técnicas:** Base en pedidos manuales de Medusa (`/admin/draft-orders`), a verificar (SP-02). Endpoint propio `POST /admin/pos/sales`.

#### HU-38 · Buscar productos en el punto de venta
- **Épica:** E09 · **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como vendedor, quiero buscar productos por nombre o código, para agregarlos rápido durante la venta.
- **Criterios de aceptación:**
  - [ ] La búsqueda funciona por título y por SKU.
  - [ ] Muestra las variantes con su stock disponible.
  - [ ] Una variante agotada no se puede agregar a la venta.

#### HU-39 · Ver ventas del día
- **Épica:** E09 · **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como admin, quiero ver las ventas del día en el local, para hacer el cierre de caja.
- **Criterios de aceptación:**
  - [ ] Muestra el total por medio de pago.
  - [ ] Muestra la lista de ventas con hora y vendedor.
  - [ ] Puedo cambiar la fecha consultada.

#### HU-40 · Comprobante no fiscal de venta
- **Épica:** E09 · **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como vendedor, quiero ver e imprimir un comprobante no fiscal, para entregárselo al cliente.
- **Criterios de aceptación:**
  - [ ] El comprobante dice "Documento no fiscal".
  - [ ] Incluye ítems, total y medio de pago.
  - [ ] Se puede imprimir desde el navegador.
- **Notas técnicas:** La factura se emite en ARCA, fuera del sistema.

### E10 · Stock

#### HU-41 · Ajustar stock con motivo
- **Épica:** E10 · **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como admin, quiero ajustar el stock de una variante con un motivo, para corregir diferencias de inventario.
- **Criterios de aceptación:**
  - [ ] El motivo tiene entre 5 y 200 caracteres.
  - [ ] El ajuste no puede dejar el stock en negativo (`STOCK_INSUFFICIENT`).
  - [ ] Cada ajuste queda registrado con usuario, fecha y motivo.

#### HU-42 · Evitar sobreventa
- **Épica:** E10 · **Sprint:** S3 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que las ventas simultáneas no vendan más stock del disponible, para no quedar mal con clientes.
- **Criterios de aceptación:**
  - [ ] Con 20 compras simultáneas de la última unidad, solo una se confirma.
  - [ ] Las demás reciben `STOCK_INSUFFICIENT`.
  - [ ] Ninguna variante queda con stock negativo.
- **Notas técnicas:** Prueba de carga con k6. Depende de HU-10.

### E11 · Usuarios y roles

#### HU-43 · Gestionar usuarios del admin
- **Épica:** E11 · **Sprint:** S1 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como superadmin, quiero crear usuarios admin y vendedores, para que cada persona tenga su propio acceso.
- **Criterios de aceptación:**
  - [ ] El superadmin puede crear usuarios con rol admin.
  - [ ] El admin puede crear usuarios con rol vendedor.
  - [ ] Un vendedor no puede crear ni editar usuarios.
  - [ ] Desactivar un usuario impide nuevos inicios de sesión y revoca sus tokens activos.
- **Notas técnicas:** `arquitectura.md`, sección 12.

#### HU-44 · Restringir acciones del rol vendedor
- **Épica:** E11 · **Sprint:** S6 · **Puntos:** 5 · **Prioridad:** Must
- **Descripción:** Como admin, quiero que el vendedor acceda solo a ventas y consultas, para proteger la configuración y los precios.
- **Criterios de aceptación:**
  - [ ] Las rutas fuera de la lista permitida responden `ROLE_NOT_ALLOWED` (403).
  - [ ] Cualquier ruta nueva queda denegada por defecto hasta que se agregue a la lista.
  - [ ] Existe una prueba automatizada por cada ruta del admin, que verifica el acceso de cada rol.
- **Notas técnicas:** Guard propio. `ROLE_NOT_ALLOWED` debe agregarse al catálogo de errores de `arquitectura.md`, sección 10.2.

#### HU-45 · Proteger el acceso al panel
- **Épica:** E11 · **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Should
- **Descripción:** Como superadmin, quiero contraseñas robustas y bloqueo ante intentos fallidos, para proteger el panel.
- **Criterios de aceptación:**
  - [ ] Las contraseñas tienen al menos 10 caracteres, con letras y números.
  - [ ] Después de 5 intentos fallidos, la cuenta se bloquea 15 minutos.
  - [ ] El login tiene límite de solicitudes por IP.
- **Notas técnicas:** Valores propuestos. Confirmar con el dueño antes de cerrar la historia.

### E12 · Notificaciones por email

#### HU-46 · Email de pedido confirmado
- **Épica:** E12 · **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero recibir un email cuando mi pedido queda confirmado, para tener constancia de la compra.
- **Criterios de aceptación:**
  - [ ] Se envía cuando el pedido queda pagado, con tarjeta o con transferencia confirmada.
  - [ ] Incluye número de pedido, ítems, total, medio de pago y enlace con token.
  - [ ] Si el envío falla, se reintenta y el fallo queda registrado.
- **Notas técnicas:** Bloqueante: proveedor de email (`arquitectura.md`, sección 13).

#### HU-47 · Email con datos de transferencia
- **Épica:** E12 · **Sprint:** S6 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero recibir los datos bancarios por email al elegir transferencia, para completar el pago aunque cierre la página.
- **Criterios de aceptación:**
  - [ ] Incluye titular, CBU o CVU, alias, banco, monto exacto y referencia.
  - [ ] Incluye la fecha de vencimiento de la reserva.
  - [ ] Incluye un enlace para subir el comprobante.

#### HU-48 · Aviso al admin por comprobante recibido
- **Épica:** E12 · **Sprint:** S6 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como admin, quiero recibir un aviso cuando llega un comprobante, para revisarlo a tiempo.
- **Criterios de aceptación:**
  - [ ] Se envía un email por cada comprobante recibido, al email configurado en HU-06.
  - [ ] El email incluye un enlace directo a la transferencia en el panel.
  - [ ] Los reintentos no generan avisos duplicados.

#### HU-49 · Email de transferencia rechazada
- **Épica:** E12 · **Sprint:** S7 · **Puntos:** 2 · **Prioridad:** Must
- **Descripción:** Como cliente, quiero saber por qué rechazaron mi comprobante, para corregirlo.
- **Criterios de aceptación:**
  - [ ] Incluye el motivo del rechazo.
  - [ ] Incluye un enlace para subir un nuevo comprobante.

### E13 · Calidad y lanzamiento

#### HU-50 · Pruebas de extremo a extremo
- **Épica:** E13 · **Sprint:** S7 · **Puntos:** 8 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que los flujos críticos estén probados de punta a punta, para lanzar con confianza.
- **Criterios de aceptación:**
  - [ ] Pasan en staging los escenarios: compra con tarjeta en sandbox, compra por transferencia completa, venta en el local, vencimiento de reserva, rechazo y reintento de comprobante.
  - [ ] Se adjunta un reporte de ejecución a la versión que sale a producción.
- **Notas técnicas:** Playwright.

#### HU-51 · Textos legales publicados
- **Épica:** E13 · **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Must
- **Descripción:** Como dueño del comercio, quiero que la tienda publique la política de privacidad, los términos y condiciones y el derecho de revocación, para cumplir la normativa de venta a distancia.
- **Criterios de aceptación:**
  - [ ] Los tres documentos están publicados y enlazados desde el pie de página y el checkout.
  - [ ] Un profesional revisó los textos y la revisión quedó registrada.
- **Bloqueante:** Confirmar el plazo del derecho de revocación con la fuente oficial antes de publicarlo.

#### TEC-01 · Pipeline de integración continua
- **Épica:** E13 · **Sprint:** S0 · **Puntos:** 3 · **Prioridad:** Must · **Tipo:** Técnica
- **Descripción:** Como equipo de desarrollo, quiero que cada cambio pase automáticamente por lint, pruebas y build, para detectar errores antes de llegar a staging.
- **Criterios de aceptación:**
  - [ ] Cada pull request ejecuta lint, pruebas y build de backend y storefront.
  - [ ] Un pull request con fallos no puede integrarse.
  - [ ] Al integrar en la rama principal se construye la imagen Docker del backend.

#### TEC-02 · Pruebas de carga de reserva de stock
- **Épica:** E13 · **Sprint:** S7 · **Puntos:** 3 · **Prioridad:** Should · **Tipo:** Técnica
- **Descripción:** Como equipo de desarrollo, quiero medir la concurrencia de la reserva de stock, para confirmar que HU-42 se cumple bajo carga.
- **Criterios de aceptación:**
  - [ ] Existe un script de k6 que simula compras simultáneas de una misma variante.
  - [ ] El informe de la prueba se guarda con la versión probada.

#### SP-02 · Verificar la documentación técnica de Medusa 2.22
- **Épica:** E01 · **Sprint:** S0 · **Puntos:** 2 · **Prioridad:** Must · **Tipo:** Spike
- **Descripción:** Como equipo de desarrollo, quiero confirmar los puntos pendientes de la arquitectura contra la documentación de la versión instalada, para no implementar sobre supuestos.
- **Criterios de aceptación:**
  - [ ] Confirmar nombres de endpoints nativos usados en `arquitectura.md`, sección 8.2.
  - [ ] Confirmar que las promociones automáticas por porcentaje sobre el pedido son posibles.
  - [ ] Confirmar si la sesión de pago se reinicia al cambiar el total del carrito.
  - [ ] Confirmar la convención de montos (unidades o centavos).
  - [ ] Confirmar el modo de arranque de worker y backend.
  - [ ] Confirmar si los pedidos manuales sirven como base del punto de venta.
- **Notas técnicas:** Entregable: documento con respuestas y cambios propuestos a `arquitectura.md`.

---

## 8. Preguntas bloqueantes

Estas preguntas afectan historias concretas. Mientras no se respondan, esas historias no pasan a "Listo para desarrollo".

| # | Pregunta | Historias afectadas | Responde |
|---|---|---|---|
| 1 | ¿Efectivo y transferencia en el local tienen descuento, o el total del local siempre es precio de lista? | HU-37 | Dueño del comercio |
| 2 | ¿Un producto puede estar en más de una subcategoría? | HU-07 | Dueño del comercio |
| 3 | ¿Qué proveedor de email usamos? | HU-46 a HU-49 | Equipo y dueño |
| 4 | ¿Cuál es el plazo del derecho de revocación para venta a distancia en Argentina? | HU-51 | Revisión legal |
| 5 | ¿Cuál es el nombre comercial y el dominio del cliente? | HU-02, HU-03, HU-51 | Dueño del comercio |

## 9. Plan de sprints

Estimación orientativa: 8 sprints de 2 semanas, unas 16 semanas de trabajo. Los puntos por sprint son una propuesta, y se ajustan con la capacidad real después del primer sprint.

| Sprint | Objetivo | Historias | Puntos |
|---|---|---|---|
| **S0** · Fundación | Entorno local, staging y base técnica listos | HU-01, HU-02, HU-03, TEC-01, SP-02 | 18 |
| **S1** · Catálogo en el admin | El dueño puede cargar su catálogo completo | HU-06, HU-07, HU-08, HU-09, HU-10, HU-11, HU-12, HU-43 | 33 |
| **S2** · Tienda de lectura | El cliente ve y elige productos | HU-13, HU-14, HU-15, HU-16, HU-17, HU-18 | 32 |
| **S3** · Carrito y checkout | Se puede armar un pedido completo, incluido el stock | HU-19, HU-20, HU-21, HU-22, HU-23, HU-32, HU-42, SP-01 | 35 |
| **S4** · Pagos | Pago con tarjeta y comienzo del pago por transferencia | HU-04, HU-24, HU-25, HU-27, HU-28 | 31 |
| **S5** · Transferencias y pedidos | Comprobantes verificados y gestión de pedidos | HU-05, HU-26, HU-29, HU-30, HU-31, HU-33, HU-34, HU-35, HU-36 | 37 |
| **S6** · Punto de venta y emails | Ventas en el local y comunicación al cliente | HU-37, HU-38, HU-40, HU-41, HU-44, HU-46, HU-47, HU-48 | 30 |
| **S7** · Cierre y lanzamiento | Pruebas, textos legales, seguridad y aviso de rechazo | HU-39, HU-45, HU-49, HU-50, HU-51, TEC-02 | 22 |

**Total:** 238 puntos en 8 sprints. Incluye las historias, spikes y tareas técnicas de este documento.

Las historias de E07 que dependen de Mercado Pago (HU-24, HU-25) quedan en S4 porque necesitan SP-01 terminado en S3. Si SP-01 se alarga, HU-24 y HU-25 pasan a S5 y el resto se reordena sin perder el objetivo de S4.

## 10. Riesgos del plan

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El plugin de Mercado Pago no sirve y hay que desarrollar el proveedor | Media | Alto | SP-01 en S3, con tiempo para desarrollar el proveedor en S4. |
| La sesión de pago no se recalcula al cambiar de medio | Media | Medio | SP-02 en S0. Si falla, se agrega reinicio explícito de la sesión en HU-22. |
| Preguntas de negocio sin respuesta antes de S3 | Alta | Medio | Las preguntas bloqueantes de la sección 8 se revisan en la planificación de cada sprint. |
| Capacidad real menor a 35 puntos | Media | Medio | Revisar después de S1 y mover historias de prioridad Should a sprints posteriores. |
| Errores de concurrencia en stock | Baja | Alto | HU-42 con pruebas de carga, y TEC-02 antes del lanzamiento. |
| Falla de la VPS sin copias recientes | Baja | Alto | HU-05 en S5 y restauración de prueba antes de lanzar. Si HU-05 se retrasa, no se lanza sin ella. |
| Textos legales sin revisar a tiempo | Media | Alto | HU-51 empieza en S6, con revisión profesional encargada desde S5. |

## 11. Ceremonias

| Ceremonia | Frecuencia | Duración | Propósito |
|---|---|---|---|
| Planificación de sprint | Inicio de cada sprint | 1 hora | Elegir historias, confirmar criterios y objetivo del sprint. |
| Daily | Diaria | 15 minutos | Qué se terminó, qué sigue y qué bloquea. Revisar el tablero. |
| Revisión (demo) | Fin de cada sprint | 45 minutos | Mostrar historias aceptadas al dueño del comercio. |
| Retrospectiva | Fin de cada sprint | 30 minutos | Qué mejorar del proceso. Se registra una acción concreta por sprint. |
| Refinamiento del backlog | Semanal | 1 hora | Estimar, dividir historias grandes y responder preguntas bloqueantes. |

## 12. Métricas

| Métrica | Qué mide | Cómo se usa |
|---|---|---|
| Velocidad | Puntos aceptados por sprint | Planificar la capacidad del siguiente sprint. |
| Tiempo de ciclo | Días desde "En progreso" hasta "Hecha" | Detectar historias que se atascan. |
| Throughput | Historias terminadas por semana | Confirmar que el flujo es estable. |
| Trabajo en curso | Historias en cada columna frente a su límite | Respetar los límites y detectar cuellos de botella. |
| Bugs post-entrega | Bugs encontrados después de aceptar una historia | Medir la calidad de los criterios y de las pruebas. |

## 13. Convenciones de nombres

- **Historias:** `HU-XX`, numeradas en orden de creación. El número no cambia aunque cambie la prioridad.
- **Tareas técnicas:** `TEC-XX`.
- **Spikes:** `SP-XX`.
- **Bugs:** `BUG-XX`, con referencia a la historia afectada en el título.
- **Ramas de Git:** `feature/HU-XX-descripcion-corta`, `fix/BUG-XX-descripcion-corta`.
- **Commits:** mensajes en español, con el ID de la historia al inicio: `HU-14: agregar filtro por subcategoría`.
- **Pull requests:** título con el ID de la historia y enlace al ticket.

## 14. Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-10-23 | Primera versión del plan: 51 historias de usuario, 2 spikes y 2 tareas técnicas, organizadas en 8 sprints. |
