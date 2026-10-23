# Seguridad: Tienda online + punto de venta (MVP0)

**Versión:** 1
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Documentos relacionados:** `arquitectura.md`, `producto.md`, `planning.md`

> Este documento revisa la arquitectura desde el punto de vista de la seguridad: qué protegemos, de quién, por dónde podrían atacarnos y qué controles aplicamos. Cada control tiene un identificador (`SEC-XX`) que se referencia desde las historias de `planning.md`.
>
> Las afirmaciones marcadas **[Verificar]** deben confirmarse contra la documentación de la versión instalada antes de implementarlas.

---

## 1. Activos

| Activo | Por qué importa | Dónde vive |
|---|---|---|
| Datos de clientes (nombre, email, teléfono, dirección, documento) | Datos personales. Su filtración tiene impacto legal y de reputación. | PostgreSQL |
| Comprobantes de transferencia | Contienen datos bancarios y personales. | Bucket privado de R2 |
| Pedidos, pagos y stock | Su alteración genera pérdidas económicas directas. | PostgreSQL |
| Credenciales de Mercado Pago | Permiten operar sobre los cobros del comercio. | Variables de entorno en Coolify |
| Cuentas del panel | Dan control total sobre precios, stock y pedidos. | Medusa |
| Panel de Coolify | Da control total sobre el servidor, los contenedores y todos los secretos. | VPS |
| Copias de seguridad | Contienen todos los datos anteriores. | Bucket de respaldos en R2 |

## 2. Actores de amenaza

| Actor | Motivación | Capacidad típica |
|---|---|---|
| Bots automatizados | Explotar vulnerabilidades conocidas, probar contraseñas | Escaneo masivo de puertos y rutas |
| Comprador malicioso | Pagar menos, obtener productos sin pagar, ver pedidos ajenos | Manipular solicitudes desde el navegador |
| Competidor o troll | Bloquear stock con pedidos falsos | Crear muchos pedidos como invitado |
| Empleado con acceso al panel | Alterar precios, stock o ventas | Cuenta de vendedor legítima |
| Atacante con una credencial filtrada | Robo de datos, fraude | Acceso al panel, a Coolify o a un bucket |

## 3. Superficie de ataque

| Punto de entrada | Expuesto a internet | Notas |
|---|---|---|
| Storefront (Next.js) | Sí | Público por diseño. |
| API de tienda de Medusa (`/store/*`) | Sí | Requiere clave publicable, que es pública por diseño y no es un secreto. |
| API y panel de admin de Medusa (`/admin/*`, `/app`) | Sí | Protegido por autenticación. Ver SEC-20 a SEC-24. |
| Webhook de Mercado Pago | Sí | Debe validarse la firma de cada notificación. |
| Panel de Coolify | **No debe estarlo** | Ver SEC-02. |
| SSH de la VPS | Restringido | Solo con clave. |
| PostgreSQL y Redis | **No** | Solo en la red interna de Docker. |
| Buckets de R2 | Público solo el de imágenes | Comprobantes y respaldos son privados. |

## 4. Controles por capa

### 4.1 Servidor y Coolify

**SEC-01 · Endurecimiento de la VPS.**
- SSH solo con clave pública. Contraseña y acceso directo como root deshabilitados.
- Firewall con solo los puertos 22, 80 y 443 abiertos. El puerto 22 restringido por IP si es posible.
- Bloqueo automático de IPs con intentos fallidos de SSH (por ejemplo, fail2ban).
- Actualizaciones de seguridad automáticas del sistema operativo.
- **Atención:** Docker puede publicar puertos sin pasar por las reglas del firewall del sistema. Por eso ningún servicio interno debe publicar puertos (ver SEC-04).

**SEC-02 · Panel de Coolify no expuesto públicamente.**
Coolify tuvo en 2026 varias vulnerabilidades críticas de ejecución remota de código para usuarios autenticados, corregidas en versiones 4.0.0-beta.464, 469 y 470. Un compromiso del panel equivale a un compromiso total del servidor. Controles:
- Acceso al panel solo por VPN (por ejemplo, Tailscale o WireGuard) o con una lista de IPs permitidas.
- Autenticación de dos factores en todas las cuentas de Coolify.
- Una sola cuenta de administración, sin cuentas compartidas.
- Registro público de usuarios deshabilitado.

**SEC-03 · Actualización de Coolify.**
- Revisar los avisos de seguridad del repositorio de Coolify al menos una vez por semana.
- Aplicar parches críticos dentro de las 72 horas.
- Nunca correr una versión con vulnerabilidades críticas conocidas.

**SEC-04 · Bases de datos sin acceso público.**
- PostgreSQL y Redis no publican puertos. La opción de hacerlos públicos en Coolify queda desactivada.
- Contraseñas generadas aleatoriamente y distintas por entorno.
- Conexión a PostgreSQL con SSL si la configuración de producción de Medusa lo exige. **[Verificar]**

**SEC-05 · Contenedores.**
- Imágenes con usuario sin privilegios (no root).
- Imágenes base oficiales con versión fija y actualizadas en cada despliegue.
- El socket de Docker nunca se monta dentro de un contenedor de la aplicación.

### 4.2 Secretos

**SEC-10 · Gestión de secretos.**
- Los secretos se guardan solo como variables de entorno en Coolify. Nunca en el repositorio, en logs ni en el storefront.
- `JWT_SECRET` y `COOKIE_SECRET` se generan con al menos 32 bytes aleatorios y son distintos por entorno.
- Credenciales de Mercado Pago de prueba en desarrollo y staging, de producción solo en producción.
- Credenciales de R2 separadas por bucket (imágenes, comprobantes, respaldos), cada una con permisos solo sobre su bucket.
- En el storefront, solo pueden tener el prefijo `NEXT_PUBLIC_` la URL del backend y la clave publicable. Cualquier otra variable pública es un error.

**SEC-11 · Rotación.**
- Rotar todos los secretos ante cualquier sospecha de filtración, y al salir una persona del equipo.
- Procedimiento de rotación documentado en el README.

### 4.3 Red y transporte

**SEC-15 · HTTPS en todo.**
- Certificados emitidos por el proxy de Coolify.
- Redirección de HTTP a HTTPS.
- Encabezado HSTS en el storefront y en el backend.

**SEC-16 · CORS estricto.**
- `STORE_CORS`, `ADMIN_CORS` y `AUTH_CORS` con los dominios exactos de cada entorno. Nunca comodines.

**SEC-17 · Límite de solicitudes.**
Medusa no incluye un limitador de solicitudes de fábrica **[Verificar]**. Se aplica en el proxy de Coolify o con un middleware propio, con estos valores iniciales:

| Ruta | Límite inicial |
|---|---|
| Login de admin (`/auth/user/*`) | 5 por minuto por IP |
| Creación de carritos y pedidos | 10 por minuto por IP |
| Subida de comprobantes | 5 por hora por pedido |
| Webhook de Mercado Pago | Sin límite estricto, con validación de firma obligatoria |
| Resto de la API de tienda | 120 por minuto por IP |

### 4.4 Autenticación y autorización

**SEC-20 · Cuentas del panel.**
- Cuentas individuales. Nunca cuentas compartidas.
- Contraseñas de al menos 12 caracteres.
- Los intentos de login quedan limitados por SEC-17.
- Bloqueo por intentos fallidos y doble factor quedan para el MVP1, salvo que Medusa los traiga de fábrica **[Verificar]**.

**SEC-21 · Roles con permisos mínimos.**
- Medusa incorporó funciones de roles y políticas (RBAC) en versiones recientes **[Verificar]** si están disponibles en la versión de código abierto 2.22 y cómo se habilitan.
- Si están disponibles, se usan. Si no, se implementa un guard propio que **deniega por defecto** cualquier ruta de `/admin/*` no incluida en la lista del rol vendedor.
- Cada ruta del admin tiene una prueba automatizada que verifica el acceso de cada rol.
- El rol vendedor se crea y se restringe en el mismo sprint. Nunca existe un vendedor sin restricciones.

**SEC-22 · Superadmin separado.**
- El superadmin es una cuenta del equipo desarrollador, distinta de cualquier cuenta del dueño.
- Solo el superadmin modifica regiones, impuestos, proveedores de pago y claves de API.

**SEC-23 · Sesiones.**
- Vencimiento de sesión de admin definido y razonable (por ejemplo, 12 horas).
- Cookies de sesión con `HttpOnly`, `Secure` y `SameSite`. **[Verificar]** el mecanismo exacto de Medusa 2.22.

**SEC-24 · Acceso del cliente a su pedido.**
- El enlace del email incluye un token aleatorio de al menos 32 bytes, propio de cada pedido.
- El token **no es de un solo uso**: se usa para ver el pedido, subir el comprobante y volver a subirlo si se rechaza.
- En la base de datos se guarda solo el hash del token, nunca el token.
- La comparación del token se hace en tiempo constante.
- El token vence 30 días después de que el pedido se cierra (pagado y entregado, cancelado o reembolsado).
- Sin token válido, la respuesta no revela si el pedido existe.

### 4.5 Integridad de precios y pagos

**SEC-30 · El precio lo calcula siempre el servidor.**
- El storefront nunca envía precios ni totales. Solo identificadores de variante y cantidades.
- Los totales los calcula Medusa.

**SEC-31 · Descuento por transferencia protegido.**
- El código de la promoción es interno, largo y aleatorio. No se muestra al cliente.
- Al completar el pedido, un hook rechaza el pedido si la promoción está presente y el medio de pago no es transferencia (`DISCOUNT_PAYMENT_MISMATCH`).
- Si el código se filtra, el hook igual impide usarlo con tarjeta.

**SEC-32 · Webhook de Mercado Pago.**
Cada notificación se valida así:
1. Se toma el header `x-signature` y se extraen `ts` y `v1`.
2. Se arma el texto `id:[data.id];request-id:[x-request-id];ts:[ts];` con el `data.id` de la URL y el header `x-request-id`.
3. Se calcula un HMAC SHA256 en hexadecimal con la clave secreta del webhook.
4. Se compara con `v1` usando comparación de tiempo constante.
5. Se rechaza la notificación si `ts` es más antiguo que una ventana definida (por ejemplo, 5 minutos), para evitar reenvíos.
6. Si la firma es válida, **se consulta el pago directamente a la API de Mercado Pago**. El contenido de la notificación nunca se usa para cambiar un estado.
7. Se verifica que el monto, la moneda y la referencia externa del pago coincidan con el pedido.
8. Se procesa de forma idempotente, usando el identificador del pago como clave.

**SEC-33 · Retorno desde Mercado Pago.**
La página de regreso del cliente solo muestra el estado que consulta el backend. Los parámetros de la URL de regreso no cambian el estado del pedido.

### 4.6 Abuso de stock y pedidos

**SEC-40 · Límite de pedidos pendientes.**
- Máximo de 2 pedidos por transferencia pendientes por email.
- Máximo de 3 pedidos pendientes por IP en 24 horas.
- Máximo de 5 unidades por variante en un mismo pedido online. El admin puede ajustar este valor.
- Vencimiento de pedidos por transferencia: 24 horas por defecto.

Los valores son iniciales y se ajustan con datos reales.

### 4.7 Archivos

**SEC-50 · Imágenes de producto.**
- Solo el admin sube imágenes.
- Formatos JPG, PNG y WebP, hasta 5 MB, validando el tipo real del archivo.

**SEC-51 · Comprobantes.**
- Tipo de archivo validado por su contenido, no por la extensión. JPG, PNG o PDF, hasta 5 MB.
- Nombre en el bucket generado por el sistema.
- Se guarda el hash SHA-256 de cada archivo para detectar comprobantes repetidos entre pedidos distintos.
- Acceso solo con enlaces firmados de 15 minutos, generados después de verificar el permiso.
- Los enlaces apuntan al dominio de R2, distinto del dominio del panel. Así, un PDF malicioso no puede ejecutar código en el contexto del panel.
- Se sirven con `Content-Disposition: attachment` cuando son PDF.
- Antivirus sobre los archivos: MVP1.

**SEC-52 · Buckets.**
- Bucket de imágenes: lectura pública por dominio propio, sin listado de contenido.
- Buckets de comprobantes y respaldos: sin acceso público de ningún tipo.

### 4.8 Storefront

**SEC-60 · Encabezados de seguridad.**
- `Content-Security-Policy` que permita solo los orígenes necesarios: el propio dominio, el backend, el dominio de imágenes y Mercado Pago.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva y protección contra inserción en iframes.

**SEC-61 · Server Actions y rutas del servidor.**
- Toda entrada se valida en el servidor con un esquema (por ejemplo, Zod).
- El identificador del carrito se guarda en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`.

**SEC-62 · Next.js actualizado.**
- Versión fijada (16.4.3) y actualizada después de cada aviso de seguridad.

### 4.9 Datos personales

**SEC-70 · Minimización.**
- Solo se piden los datos necesarios para el pedido. El documento es opcional.
- Los logs no registran CBU, documento, teléfono, dirección ni contenido de comprobantes.

**SEC-71 · Retención.**
- Se define con el dueño el plazo de conservación de pedidos y comprobantes, considerando las obligaciones fiscales.
- La política de privacidad del sitio describe qué datos se guardan y para qué. Revisión profesional antes del lanzamiento.

### 4.10 Dependencias y código

**SEC-80 · Cadena de suministro.**
- Lockfile versionado e instalaciones con `npm ci` (o el equivalente del gestor elegido).
- Auditoría de dependencias en cada pull request. Las vulnerabilidades críticas bloquean el merge.
- Actualizaciones de dependencias automatizadas y revisadas (Renovate o Dependabot).

**SEC-81 · Plugins de terceros.**
Un plugin de Medusa corre con todos los permisos del backend. Antes de adoptar cualquier plugin (por ejemplo, el de Mercado Pago):
- Revisar el código fuente, la actividad del mantenedor y la licencia.
- Fijar la versión exacta.
- Preferir un proveedor propio pequeño si el plugin no es confiable.

### 4.11 Respaldos y recuperación

**SEC-90 · Respaldos.**
- Respaldo diario de PostgreSQL a un bucket de R2 exclusivo para respaldos, con credenciales propias.
- Respaldos cifrados antes de subirlos.
- Retención de 30 días.
- Restauración de prueba mensual en staging, con registro del resultado.
- Los comprobantes se conservan con el mismo cuidado, porque son la única prueba de una transferencia.

### 4.12 Registro y monitoreo

**SEC-95 · Eventos de seguridad registrados.**
- Logins exitosos y fallidos del panel.
- Capturas, reembolsos y cancelaciones, con el usuario que los hizo.
- Webhooks rechazados por firma inválida.
- Accesos rechazados por permisos.
- Superación de límites de solicitudes.

**SEC-96 · Alertas.**
- Más de 10 logins fallidos en 10 minutos.
- Webhooks con firma inválida.
- Errores 5xx sostenidos.
- Falla de un respaldo.

## 5. Hallazgos de la revisión de la versión 1 de la arquitectura

| ID | Hallazgo | Severidad | Corrección |
|---|---|---|---|
| H-01 | El token de acceso al pedido era de un solo uso, incompatible con el flujo de comprobantes. | Alta | SEC-24 |
| H-02 | No se definía cómo validar la firma del webhook de Mercado Pago ni la verificación del monto. | Alta | SEC-32 |
| H-03 | No había controles contra pedidos falsos que bloquean stock. | Alta | SEC-40 |
| H-04 | El panel de Coolify no tenía controles de acceso definidos. | Crítica | SEC-02, SEC-03 |
| H-05 | Los vendedores existían cinco sprints sin restricciones. | Alta | SEC-21 |
| H-06 | El descuento automático podía aplicarse a pagos con tarjeta. | Media | SEC-31 |
| H-07 | No se especificaba el límite de solicitudes por ruta. | Media | SEC-17 |
| H-08 | Los comprobantes PDF podían abrirse en el contexto del panel. | Media | SEC-51 |
| H-09 | No se mencionaba el riesgo de publicar puertos de Docker por fuera del firewall. | Media | SEC-01, SEC-04 |
| H-10 | No había política de plugins de terceros. | Media | SEC-81 |
| H-11 | Los respaldos no estaban cifrados ni tenían credenciales propias. | Media | SEC-90 |

## 6. Checklist previo al lanzamiento

- [ ] Panel de Coolify accesible solo por VPN o IP permitida, con doble factor.
- [ ] Coolify en la última versión, sin avisos críticos abiertos.
- [ ] PostgreSQL y Redis sin puertos publicados.
- [ ] Todos los secretos de producción generados, distintos de staging y fuera del repositorio.
- [ ] CORS con dominios exactos.
- [ ] Límites de solicitudes activos y probados.
- [ ] Prueba automatizada de permisos por rol en verde.
- [ ] Webhook de Mercado Pago probado con firma válida, firma inválida, notificación repetida y monto distinto.
- [ ] Prueba de que el descuento de transferencia no se aplica con tarjeta.
- [ ] Prueba de acceso a un pedido ajeno con token inválido.
- [ ] Comprobantes inaccesibles sin enlace firmado.
- [ ] Encabezados de seguridad verificados en el storefront.
- [ ] Restauración de respaldo probada.
- [ ] Auditoría de dependencias sin vulnerabilidades críticas.
- [ ] Alertas configuradas y probadas.

## 7. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión: modelo de amenazas, controles por capa, hallazgos y checklist de lanzamiento. |
