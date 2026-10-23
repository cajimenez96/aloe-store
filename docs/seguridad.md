# Seguridad: Tienda online + punto de venta (MVP0)

**Versión:** 2.1
**Estado:** borrador para revisión
**Última actualización:** 2026-10-23
**Alcance actual:** desarrollo local. Cada control indica cuándo aplica.
**Documentos relacionados:** `arquitectura.md`, `producto.md`, `planning.md`

> Este documento revisa la arquitectura desde el punto de vista de la seguridad: qué protegemos, de quién, por dónde podrían atacarnos y qué controles aplicamos. Cada control tiene un identificador (`SEC-XX`) que se referencia desde las historias de `planning.md`.
>
> **Etapas:** **[Local]** aplica desde el MVP0, en la máquina de desarrollo. **[Despliegue]** se activa cuando exista un servidor o una plataforma, y no se construye en el MVP0. **[Local y despliegue]** aplica en ambos, con matices que se detallan.
>
> Las afirmaciones marcadas **[Verificar]** deben confirmarse contra la documentación de la versión instalada antes de implementarlas.

---

## 1. Activos

| Activo | Por qué importa | Hoy (local) | Al desplegar |
|---|---|---|---|
| Datos de clientes (nombre, email, teléfono, dirección, documento) | Datos personales. Su filtración tiene impacto legal y de reputación. | No hay datos reales: solo datos de prueba descartables | PostgreSQL |
| Comprobantes de transferencia | Contienen datos bancarios y personales. | Archivos de prueba en `storage/private/proofs/` | Bucket privado |
| Pedidos, pagos y stock | Su alteración genera pérdidas económicas directas. | Datos de prueba | PostgreSQL |
| Credenciales de Mercado Pago | Permiten operar sobre los cobros del comercio. | Credenciales de prueba en `.env` y en el gestor de contraseñas | Variables de la plataforma, con credenciales de producción |
| Cuentas del panel | Dan control total sobre precios, stock y pedidos. | Cuentas locales de prueba | Medusa |
| Código y documentación | Es el trabajo del proyecto. | Repositorio local | Igual |
| Panel de la plataforma de despliegue | Da control total sobre el servidor y todos los secretos. | No existe | Por definir |
| Copias de seguridad | Contienen todos los datos anteriores. | No aplica | Bucket exclusivo de respaldos |

**Regla de oro del MVP0:** en local nunca se cargan datos reales de clientes. Así, un incidente en la máquina de desarrollo no expone datos personales de nadie.

## 2. Actores de amenaza

| Actor | Motivación | Capacidad típica | Etapa |
|---|---|---|---|
| Error humano del desarrollador | Ninguna. Es un accidente. | Subir un secreto al repositorio, dejar servicios escuchando en toda la red | Local |
| Malware o robo del equipo de desarrollo | Obtener credenciales | Leer archivos `.env` y bases de datos locales | Local |
| Comprador malicioso | Pagar menos, obtener productos sin pagar, ver pedidos ajenos | Manipular solicitudes desde el navegador | Local y despliegue |
| Competidor o troll | Bloquear stock con pedidos falsos | Crear muchos pedidos como invitado | Local y despliegue |
| Empleado con acceso al panel | Alterar precios, stock o ventas | Cuenta de vendedor legítima | Local y despliegue |
| Bots automatizados | Explotar vulnerabilidades conocidas, probar contraseñas | Escaneo masivo de puertos y rutas | Despliegue |
| Atacante con una credencial filtrada | Robo de datos, fraude | Acceso al panel, a la plataforma o a un bucket | Despliegue |

## 3. Superficie de ataque

### 3.1 En local

| Punto de entrada | Alcance | Notas |
|---|---|---|
| Storefront (`:3000`) | Solo localhost | **[Confirmado]** `next dev -H 127.0.0.1`: escucha en `127.0.0.1` y no responde por la IP de la red local. |
| Medusa (`:9000`: `/store`, `/admin`, `/app`, `/hooks`) | Solo localhost | **[Confirmado]** `medusa develop --host 127.0.0.1`: escucha en `127.0.0.1` y no responde por la IP de la red local. |
| PostgreSQL y Redis | Solo `127.0.0.1` | Docker publica puertos en todas las interfaces por defecto, por eso se fija `127.0.0.1` (SEC-04). |
| Webhook de Mercado Pago | No recibe nada sin URL pública | Mercado Pago no puede llegar a `localhost`. |
| Túnel temporal (opcional) | Internet, mientras esté activo | Expone todo el backend local. Ver SEC-07. |
| Archivos locales | Disco de la máquina | `static/` es público para Medusa. `storage/private/` no se sirve de forma directa. |

### 3.2 Al desplegar

| Punto de entrada | Expuesto a internet | Notas |
|---|---|---|
| Storefront | Sí | Público por diseño. |
| API de tienda de Medusa (`/store/*`) | Sí | Requiere clave publicable, que es pública por diseño y no es un secreto. |
| API y panel de admin de Medusa (`/admin/*`, `/app`) | Sí | Protegido por autenticación. Ver SEC-20 a SEC-24. |
| Webhook de Mercado Pago | Sí | Debe validarse la firma de cada notificación (SEC-32). |
| Panel de la plataforma | **No debe estarlo** | Ver SEC-02. |
| SSH del servidor | Restringido | Solo con clave. |
| PostgreSQL y Redis | **No** | Solo en la red interna. |
| Almacenamiento externo | Público solo el de imágenes | Comprobantes y respaldos son privados. |

## 4. Controles por capa

### 4.1 Entorno de desarrollo, servidor y plataforma

**SEC-01 · Endurecimiento del servidor.** [Despliegue]
- SSH solo con clave pública. Contraseña y acceso directo como root deshabilitados.
- Firewall con solo los puertos 22, 80 y 443 abiertos. El puerto 22 restringido por IP si es posible.
- Bloqueo automático de IPs con intentos fallidos de SSH (por ejemplo, fail2ban).
- Actualizaciones de seguridad automáticas del sistema operativo.
- **Atención:** Docker puede publicar puertos sin pasar por las reglas del firewall del sistema. Por eso ningún servicio interno debe publicar puertos (ver SEC-04).

**SEC-02 · Panel de la plataforma no expuesto públicamente.** [Despliegue]
Aplica si la plataforma elegida es Coolify, que es el plan previsto. Coolify tuvo en 2026 varias vulnerabilidades críticas de ejecución remota de código para usuarios autenticados. Un compromiso del panel equivale a un compromiso total del servidor. Controles:
- Acceso al panel solo por VPN o con una lista de IPs permitidas. Las opciones son: un plan pago de Tailscale (el plan gratuito Personal es solo para uso no comercial), WireGuard propio, o una lista de IPs si la IP es fija.
- Autenticación de dos factores en todas las cuentas de la plataforma.
- Una sola cuenta de administración, sin cuentas compartidas, y registro público de usuarios deshabilitado.
- **Primer arranque:** la primera persona que abre el panel crea la cuenta con privilegios. La cuenta de administración se crea apenas termina la instalación, y el puerto del panel se restringe a tu IP con el firewall del proveedor del servidor (no alcanza con el firewall del sistema, por el comportamiento de Docker).
- Los secretos de instalación (por ejemplo, la clave `APP_KEY` de Coolify) se respaldan en el gestor de contraseñas.

**SEC-03 · Actualización de la plataforma.** [Despliegue]
- Revisar los avisos de seguridad de la plataforma al menos una vez por semana.
- Aplicar parches críticos dentro de las 72 horas.
- Nunca correr una versión con vulnerabilidades críticas conocidas.

**SEC-04 · Bases de datos sin acceso desde la red.** [Local y despliegue]
- **Local:** PostgreSQL y Redis se publican solo en `127.0.0.1` en `docker-compose.yml`. Contraseñas locales distintas de las de cualquier otro entorno.
- **Despliegue:** no publican puertos y la opción de hacerlos públicos en la plataforma queda desactivada. Contraseñas generadas aleatoriamente y distintas por entorno. Conexión a PostgreSQL con SSL si la configuración de producción de Medusa lo exige. **[Confirmado]** Medusa activa SSL para cualquier host que no sea `localhost` o `127.0.0.1`, salvo que la URL lleve `sslmode=disable`.

**SEC-05 · Contenedores.** [Despliegue]
- Imágenes con usuario sin privilegios (no root).
- Imágenes base oficiales con versión fija y actualizadas en cada despliegue.
- El socket de Docker nunca se monta dentro de un contenedor de la aplicación.

**SEC-06 · Máquina de desarrollo.** [Local]
- Disco cifrado, bloqueo de pantalla y actualizaciones del sistema al día.
- Los servicios de desarrollo escuchan solo en localhost. Esto evita que otras personas de una red compartida, como una red pública, lleguen al panel o a las bases.
- Gestor de contraseñas con doble factor, y doble factor en las cuentas que se usen (repositorio remoto, si existe, y Mercado Pago).
- Ningún dato real de clientes en la máquina.

**SEC-07 · Túnel temporal.** [Local]
Si se usa un túnel para probar Mercado Pago con URL pública (`arquitectura.md`, sección 10.4):
- Se activa solo durante la prueba y se cierra al terminar. No se deja abierto sin supervisión.
- Mientras está activo, todo el backend local queda accesible desde internet. Por eso se usa solo con datos de prueba y con contraseñas fuertes en las cuentas del panel.
- Si la herramienta permite limitar el acceso a una ruta, se limita al webhook.
- Se revisan los requisitos de cuenta y las condiciones de la herramienta antes de elegirla.

### 4.2 Secretos

**SEC-10 · Gestión de secretos.** [Local y despliegue]
- **Local:** `.env` no se versiona y `.env.example` sí, sin valores reales. Un hook de Git bloquea el commit de archivos `.env` y de patrones de claves. `JWT_SECRET`, `COOKIE_SECRET` y `PROOFS_URL_SIGNING_SECRET` se generan con al menos 32 bytes aleatorios en cada máquina. Solo se usan credenciales de prueba de Mercado Pago. Las credenciales se guardan en el gestor de contraseñas.
- **Despliegue:** los secretos viven solo como variables de la plataforma, distintos por entorno. Credenciales de almacenamiento separadas por bucket, cada una con permisos solo sobre su bucket.
- **En ambos:** en el storefront solo pueden tener el prefijo `NEXT_PUBLIC_` la URL del backend, la clave publicable y el host de imágenes. Cualquier otra variable pública es un error. Los secretos nunca aparecen en el repositorio, en logs ni en el storefront.

**SEC-11 · Rotación.** [Despliegue]
- Rotar todos los secretos ante cualquier sospecha de filtración, y al salir una persona del equipo.
- Procedimiento de rotación documentado en el README.
- En local, un secreto expuesto por error se rota en el momento: se regenera y se invalida el anterior.

### 4.3 Red y transporte

**SEC-15 · HTTPS en todo.** [Despliegue]
- Certificados emitidos por la plataforma.
- Redirección de HTTP a HTTPS.
- Encabezado HSTS en el storefront y en el backend.

**SEC-16 · CORS estricto.** [Local y despliegue]
- `STORE_CORS`, `ADMIN_CORS` y `AUTH_CORS` con los orígenes exactos de cada entorno: `localhost` con sus puertos en local, dominios exactos al desplegar. Nunca comodines.

**SEC-17 · Límite de solicitudes.** [Local y despliegue]
Medusa no incluye un limitador de solicitudes de fábrica **[Confirmado]**. Se implementa en la aplicación con un middleware propio, de modo que se pueda probar en local. Al desplegar se puede sumar un límite adicional en el proxy. Valores iniciales:

| Ruta | Límite inicial |
|---|---|
| Login de admin (`/auth/user/*`) | 5 por minuto por IP |
| Creación de carritos y pedidos | 10 por minuto por IP |
| Subida de comprobantes | 5 por hora por pedido |
| Webhook de Mercado Pago | Sin límite estricto, con validación de firma obligatoria |
| Resto de la API de tienda | 120 por minuto por IP |

### 4.4 Autenticación y autorización

**SEC-20 · Cuentas del panel.** [Local y despliegue]
- Cuentas individuales. Nunca cuentas compartidas ni credenciales por defecto.
- Contraseñas de al menos 12 caracteres.
- Los intentos de login quedan limitados por SEC-17.
- Bloqueo por intentos fallidos y doble factor quedan para el MVP1. **[Confirmado]** Medusa no los trae de fábrica.

**SEC-21 · Roles con permisos mínimos.** [Local y despliegue]
- **[Confirmado]** el módulo de roles y políticas (RBAC) de Medusa 2.22 está desactivado por defecto y requiere una licencia. No se usa.
- Se implementa un guard propio que **deniega por defecto** cualquier ruta de `/admin/*` no incluida en la lista del rol vendedor.
- Cada ruta del admin tiene una prueba automatizada que verifica el acceso de cada rol.
- El rol vendedor se crea y se restringe en el mismo sprint. Nunca existe un vendedor sin restricciones.

**SEC-22 · Superadmin separado.** [Local y despliegue]
- El superadmin es una cuenta del equipo desarrollador, distinta de cualquier cuenta del dueño.
- Solo el superadmin modifica regiones, impuestos, proveedores de pago y claves de API.

**SEC-23 · Sesiones.** [Local y despliegue]
- Vencimiento de sesión de admin definido y razonable. **[Confirmado]** el valor por defecto de Medusa es 10 horas (`sessionOptions.ttl`).
- **[Confirmado]** cookie de sesión `connect.sid`, `HttpOnly`. En `production` y `staging` Medusa la fija `Secure` y `SameSite=Lax`; en desarrollo no, que es lo esperado en local sin HTTPS.

**SEC-24 · Acceso del cliente a su pedido.** [Local y despliegue]
- El enlace del email incluye un token aleatorio de al menos 32 bytes, propio de cada pedido.
- El token **no es de un solo uso**: se usa para ver el pedido, subir el comprobante y volver a subirlo si se rechaza.
- En la base de datos se guarda solo el hash del token, nunca el token.
- La comparación del token se hace en tiempo constante.
- El token vence 30 días después de que el pedido se cierra (pagado y entregado, cancelado o reembolsado).
- Sin token válido, la respuesta no revela si el pedido existe.

### 4.5 Integridad de precios y pagos

**SEC-30 · El precio lo calcula siempre el servidor.** [Local y despliegue]
- El storefront nunca envía precios ni totales. Solo identificadores de variante y cantidades.
- Los totales los calcula Medusa.

**SEC-31 · Descuento por transferencia protegido.** [Local y despliegue]
- El código de la promoción es interno, largo y aleatorio. No se muestra al cliente.
- Al completar el pedido, un hook rechaza el pedido si la promoción está presente y el medio de pago no es transferencia (`DISCOUNT_PAYMENT_MISMATCH`).
- Si el código se filtra, el hook igual impide usarlo con tarjeta.

**SEC-32 · Webhook de Mercado Pago.** [Local y despliegue]
Cada notificación se valida así:
1. Se toma el header `x-signature` y se extraen `ts` y `v1`.
2. Se arma el texto `id:[data.id];request-id:[x-request-id];ts:[ts];` con el `data.id` de la URL y el header `x-request-id`.
3. Se calcula un HMAC SHA256 en hexadecimal con la clave secreta del webhook.
4. Se compara con `v1` usando comparación de tiempo constante.
5. Se rechaza la notificación si `ts` es más antiguo que una ventana definida (por ejemplo, 5 minutos), para evitar reenvíos.
6. Si la firma es válida, **se consulta el pago directamente a la API de Mercado Pago**. El contenido de la notificación nunca se usa para cambiar un estado.
7. Se verifica que el monto, la moneda y la referencia externa del pago coincidan con el pedido.
8. Se procesa de forma idempotente, usando el identificador del pago como clave.

**Etapas:** en local se construye y se prueba con el simulador `scripts/simulate-mp-webhook.ts`, que genera notificaciones firmadas con un secreto de prueba (firma válida, inválida, vencida, repetida y con monto distinto). La verificación con notificaciones reales de Mercado Pago necesita una URL pública y queda para el despliegue (HU-51), o para un túnel temporal (SEC-07).

**SEC-33 · Retorno desde Mercado Pago.** [Local y despliegue]
La página de regreso del cliente solo muestra el estado que consulta el backend. Los parámetros de la URL de regreso no cambian el estado del pedido. En local, la persona vuelve a mano a la página del pedido, porque Mercado Pago no recomienda `localhost` en sus URLs de retorno.

### 4.6 Abuso de stock y pedidos

**SEC-40 · Límite de pedidos pendientes.** [Local y despliegue]
- Máximo de 2 pedidos por transferencia pendientes por email.
- Máximo de 3 pedidos pendientes por IP en 24 horas.
- Máximo de 5 unidades por variante en un mismo pedido online. El admin puede ajustar este valor.
- Vencimiento de pedidos por transferencia: 24 horas por defecto.

Los valores son iniciales y se ajustan con datos reales.

### 4.7 Archivos

**SEC-50 · Imágenes de producto.** [Local y despliegue]
- Solo el admin sube imágenes.
- Formatos JPG, PNG y WebP, hasta 5 MB, validando el tipo real del archivo.
- En local, el proveedor de Medusa guarda las imágenes en `static/`, una carpeta pública. Nada privado se guarda ahí.

**SEC-51 · Comprobantes.** [Local y despliegue]
- Tipo de archivo validado por su contenido, no por la extensión. JPG, PNG o PDF, hasta 5 MB.
- Nombre en el almacenamiento generado por el sistema, sin el nombre original ni extensión.
- Se guarda el hash SHA-256 de cada archivo para detectar comprobantes repetidos entre pedidos distintos.
- Acceso solo con enlaces firmados de 15 minutos, generados después de verificar el permiso.
- **Local:** los archivos están en `storage/private/proofs/`, fuera de `static/`. Se entregan mediante una ruta del backend que valida el token firmado y la sesión, y responde con `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` y `Content-Security-Policy: sandbox`. Como esa ruta comparte origen con el panel, estos encabezados evitan que un archivo malicioso se ejecute en el contexto del panel.
- **Despliegue:** enlace firmado del almacenamiento externo, en un dominio distinto del panel.
- Antivirus sobre los archivos: MVP1.

**SEC-52 · Buckets.** [Despliegue]
- Bucket de imágenes: lectura pública por dominio propio, sin listado de contenido.
- Buckets de comprobantes y respaldos: sin acceso público de ningún tipo.

### 4.8 Storefront

**SEC-60 · Encabezados de seguridad.** [Local y despliegue]
- `Content-Security-Policy` que permita solo los orígenes necesarios: el propio origen, el backend, el host de imágenes y Mercado Pago.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva y protección contra inserción en iframes.
- `Strict-Transport-Security` (HSTS) solo al desplegar con HTTPS.

**SEC-61 · Server Actions y rutas del servidor.** [Local y despliegue]
- Toda entrada se valida en el servidor con un esquema (por ejemplo, Zod).
- El identificador del carrito se guarda en una cookie `HttpOnly` y `SameSite=Lax`. El atributo `Secure` se exige al desplegar con HTTPS.

**SEC-62 · Next.js actualizado.** [Local y despliegue]
- Versión fijada (16.4.3) y actualizada después de cada aviso de seguridad.

### 4.9 Datos personales

**SEC-70 · Minimización.** [Local y despliegue]
- Solo se piden los datos necesarios para el pedido. El documento es opcional.
- Los logs no registran CBU, documento, teléfono, dirección ni contenido de comprobantes.

**SEC-71 · Retención.** [Despliegue]
- Se define con el dueño el plazo de conservación de pedidos y comprobantes, considerando las obligaciones fiscales.
- La política de privacidad del sitio describe qué datos se guardan y para qué. Revisión profesional antes de abrir al público.

### 4.10 Dependencias y código

**SEC-80 · Cadena de suministro.** [Local y despliegue]
- Lockfile versionado e instalaciones con `npm ci`.
- **Local:** la auditoría de dependencias forma parte de `npm run check`. Una vulnerabilidad crítica bloquea el pre-push.
- **Despliegue:** la misma auditoría en la integración continua, y actualizaciones de dependencias automatizadas y revisadas (Renovate o Dependabot).

**SEC-81 · Plugins de terceros.** [Local y despliegue]
Un plugin de Medusa corre con todos los permisos del backend. Antes de adoptar cualquier plugin (por ejemplo, el de Mercado Pago):
- Revisar el código fuente, la actividad del mantenedor y la licencia.
- Fijar la versión exacta.
- Preferir un proveedor propio pequeño si el plugin no es confiable.

### 4.11 Respaldos y recuperación

**SEC-90 · Respaldos.** [Despliegue]
- Respaldo diario de PostgreSQL a un almacenamiento exclusivo para respaldos, con credenciales propias.
- Respaldos cifrados antes de subirlos.
- Retención de 30 días.
- Restauración de prueba mensual en un entorno de prueba, con registro del resultado.
- Los comprobantes se conservan con el mismo cuidado, porque son la única prueba de una transferencia.

### 4.12 Registro y monitoreo

**SEC-95 · Eventos de seguridad registrados.** [Local y despliegue]
- Logins exitosos y fallidos del panel.
- Capturas, reembolsos y cancelaciones, con el usuario que los hizo.
- Webhooks rechazados por firma inválida.
- Accesos rechazados por permisos.
- Superación de límites de solicitudes.

**SEC-96 · Alertas.** [Despliegue]
- Más de 10 logins fallidos en 10 minutos.
- Webhooks con firma inválida.
- Errores 5xx sostenidos.
- Falla de un respaldo.

## 5. Hallazgos de las revisiones

| ID | Hallazgo | Severidad | Control | Etapa |
|---|---|---|---|---|
| H-01 | El token de acceso al pedido era de un solo uso, incompatible con el flujo de comprobantes. | Alta | SEC-24 | Local |
| H-02 | No se definía cómo validar la firma del webhook de Mercado Pago ni la verificación del monto. | Alta | SEC-32 | Local |
| H-03 | No había controles contra pedidos falsos que bloquean stock. | Alta | SEC-40 | Local |
| H-04 | El panel de la plataforma no tenía controles de acceso definidos. | Crítica | SEC-02, SEC-03 | Despliegue |
| H-05 | Los vendedores existían cinco sprints sin restricciones. | Alta | SEC-21 | Local |
| H-06 | El descuento automático podía aplicarse a pagos con tarjeta. | Media | SEC-31 | Local |
| H-07 | No se especificaba el límite de solicitudes por ruta. | Media | SEC-17 | Local |
| H-08 | Los comprobantes PDF podían abrirse en el contexto del panel. | Media | SEC-51 | Local |
| H-09 | No se mencionaba el riesgo de publicar puertos de Docker por fuera del firewall. | Media | SEC-01, SEC-04 | Local y despliegue |
| H-10 | No había política de plugins de terceros. | Media | SEC-81 | Local |
| H-11 | Los respaldos no estaban cifrados ni tenían credenciales propias. | Media | SEC-90 | Despliegue |
| H-12 | La VPN propuesta para SEC-02 (plan gratuito de Tailscale) es solo para uso no comercial. | Media | SEC-02 | Despliegue |
| H-13 | La carpeta `static/` del proveedor local de Medusa es pública: un comprobante guardado ahí quedaría expuesto. | Alta | SEC-51 | Local |
| H-14 | Mercado Pago no envía webhooks a `localhost` y no recomienda `localhost` en las URLs de retorno, por lo que la verificación real queda limitada. | Media | SEC-32, SEC-33 | Local |
| H-15 | Docker publica los puertos en todas las interfaces por defecto: en una red compartida, PostgreSQL quedaría accesible. | Media | SEC-04 | Local |
| H-16 | Un túnel temporal expone todo el backend local a internet mientras está activo. | Media | SEC-07 | Local |
| H-17 | El panel de Coolify permite crear la cuenta de administración a quien lo abra primero, y su clave `APP_KEY` debe respaldarse. | Media | SEC-02 | Despliegue |
| H-18 | Con el driver local, los comprobantes se sirven desde el mismo origen que el panel. | Media | SEC-51 | Local |

## 6. Checklists

### 6.1 Para dar el MVP0 por terminado (local)

- [ ] PostgreSQL y Redis publicados solo en `127.0.0.1`. Backend y storefront escuchan solo en localhost.
- [ ] `.env` fuera de Git, hook de secretos activo y secretos generados en cada máquina.
- [ ] Ningún dato real de clientes en la base local.
- [ ] CORS con orígenes exactos.
- [ ] Límites de solicitudes activos y probados.
- [ ] Prueba automatizada de permisos por rol en verde.
- [ ] Webhook probado con el simulador: firma válida, firma inválida, notificación vencida, repetida y monto distinto.
- [ ] Prueba de que el descuento de transferencia no se aplica con tarjeta.
- [ ] Prueba de acceso a un pedido ajeno con token inválido.
- [ ] Comprobantes fuera de `static/`, inaccesibles sin sesión y token firmado vigente, y enlace vencido rechazado.
- [ ] Encabezados de seguridad verificados en el storefront (sin HSTS).
- [ ] Auditoría de dependencias sin vulnerabilidades críticas.
- [ ] Eventos de SEC-95 registrados y sin datos personales en los logs.
- [ ] Túnel temporal cerrado después de cada prueba.

### 6.2 Antes de abrir al público (etapa de despliegue)

- [ ] Panel de la plataforma accesible solo por VPN o IP permitida, con doble factor, en la última versión estable y con la cuenta de administración creada de inmediato. Secretos de instalación respaldados.
- [ ] Servidor endurecido (SEC-01). PostgreSQL y Redis sin puertos publicados.
- [ ] Secretos de producción generados de nuevo, distintos de los de prueba y fuera del repositorio.
- [ ] CORS con dominios exactos, HTTPS con HSTS y cookies `Secure`.
- [ ] Imágenes en un bucket público sin listado. Comprobantes y respaldos en buckets privados.
- [ ] Webhook de Mercado Pago verificado con notificaciones reales (HU-51).
- [ ] Credenciales de producción de Mercado Pago cargadas solo en producción.
- [ ] Restauración de respaldo probada.
- [ ] Alertas configuradas y probadas.
- [ ] Auditoría de dependencias en la integración continua.
- [ ] Botón de arrepentimiento y textos legales resueltos (HU-53).

## 7. Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-23 | 1 | Primera versión: modelo de amenazas, controles por capa, hallazgos y checklist de lanzamiento. |
| 2026-10-23 | 2 | Alcance reducido a desarrollo local. Cada control indica su etapa (local, despliegue o ambas). Nuevos controles SEC-06 (máquina de desarrollo) y SEC-07 (túnel temporal). Comprobantes con driver local y encabezados contra ejecución en el panel. Corrección de la VPN de SEC-02. Hallazgos H-12 a H-18 y checklist dividido en local y despliegue. |
| 2026-10-23 | 2.1 | Resultado de SP-01: puntos **[Verificar]** resueltos con evidencia en `sp-01-medusa.md`. |
