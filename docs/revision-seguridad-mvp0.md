# Revisión de seguridad del MVP0 (HU-45)

**Fecha:** 2026-10-24 · **Commit revisado:** `f9065e7` · **Alcance:** checklist de `seguridad.md`, sección 6.1, en local. La sección 6.2 queda como requisitos de la etapa de despliegue (más abajo).

Revisó el código quien lo escribió, con tres revisiones independientes adicionales (un revisor aparte, sin editar el repositorio, atacó cada área contra un entorno de prueba): descuento por transferencia (SEC-31), acceso al pedido con token y límites (SEC-24 y SEC-40), y comprobantes, punto de venta, límites, logs y extensiones del panel (SEC-17, SEC-51, SEC-70, SEC-95). Los bloqueantes que encontraron están corregidos y cubiertos por pruebas.

## 6.1 Checklist de cierre

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | PostgreSQL y Redis solo en `127.0.0.1`; backend y storefront solo en localhost | Cumple | `docker-compose.yml` publica `127.0.0.1:…`; `docker compose ps` lo confirma; los scripts de arranque fijan `--host 127.0.0.1` / `-H 127.0.0.1`. |
| 2 | `.env` fuera de Git, hook de secretos activo, secretos por máquina | Cumple, con una salvedad | `.env` ignorado en la raíz y en las dos apps; ningún `.env` versionado. El hook `pre-commit` se probó en un repositorio temporal: bloquea un `.env` y una clave privada y deja pasar un commit normal. **Salvedad:** `apps/backend/.env.template` (del starter de Medusa) trae `JWT_SECRET=supersecret`. No pude editarlo (permiso denegado); en su lugar, el backend en producción se niega a arrancar con secretos faltantes, de ejemplo o de menos de 32 caracteres (`lib/config/secrets.ts`, 5 pruebas). |
| 3 | Ningún dato real de clientes en la base local | Cumple por proceso | No se puede comprobar con una prueba: los datos de desarrollo son de prueba y la suite de punta a punta usa bases descartables que borra. Depende de que nadie cargue datos reales. |
| 4 | CORS con orígenes exactos | Cumple | Escenario E2E `08`: el origen del storefront recibe su `Access-Control-Allow-Origin`; `https://evil.example`, un subdominio engañoso, otro puerto y `null` no reciben ninguno. |
| 5 | Límites de solicitudes activos y probados | Cumple, con salvedades | `lib/rate-limit` (13 pruebas) y verificación en vivo: login 5/min (5 `401`, luego `429 RATE_LIMITED` con `Retry-After`), carritos 10/min, resto de la tienda 120/min, configurables con `RATE_LIMITS`; pedidos pendientes por email e IP (`MAX_PENDING_*`). Salvedades: el límite vive en la memoria de una instancia; sin `TRUSTED_PROXY_HOPS` todos los clientes comparten la IP del storefront. |
| 6 | Prueba automatizada de permisos por rol en verde | Cumple | Pruebas de unidad de `lib/roles` (política, guard y recorrido de todas las rutas de `/admin`, incluidas las nuevas): el vendedor solo puede lo permitido y toda ruta nueva queda denegada hasta habilitarla. El revisor probó variantes de ruta (mayúsculas, `;`, `//`, `%2f`, método alternativo) sin lograr un acceso indebido. |
| 7 | Webhook probado con el simulador (firma válida, inválida, vencida, repetida, monto distinto) | **No cumple** | El webhook de Mercado Pago no existe: depende de SP-02, HU-24 y HU-25. Ver decisión 1. |
| 8 | El descuento de transferencia no se aplica con tarjeta | Cumple parcialmente | Pruebas de unidad del hook `DISCOUNT_PAYMENT_MISMATCH` con un contenedor simulado (promoción + proveedor de tarjeta falla) y escenario E2E `05` (con tarjeta el total es el de lista, la ruta nativa de completar está cerrada, un código adivinado no da descuento, el código real no aparece en ninguna respuesta). **Falta** ejercitar el rechazo con un proveedor de tarjeta real (HU-24). Ver decisión 1. |
| 9 | Acceso a un pedido ajeno con token inválido | Cumple | Escenario E2E `06` y dos revisiones independientes: token malo, sin token, pedido inexistente y token de otro pedido dan la misma respuesta `404 ORDER_ACCESS_DENIED`; las rutas nativas de pedidos están cerradas. |
| 10 | Comprobantes fuera de `static/`, inaccesibles sin sesión y token firmado vigente, y enlace vencido rechazado | Cumple | Escenario E2E `08`: el archivo no está en `/static`, sin sesión da `401`, enlace alterado o de otro comprobante `403`, y con sesión y enlace vigente se entrega con `attachment`, `nosniff`, `no-store` y `CSP: sandbox`. El vencimiento de 15 minutos está en pruebas de unidad (`signed-link`) y el revisor comprobó que enlaces vencidos o con firma de otro largo dan `403`. |
| 11 | Encabezados de seguridad verificados en el storefront (sin HSTS) | Cumple, con salvedades | Escenario E2E `08` sobre seis rutas: CSP, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` y sin HSTS. Salvedades: la CSP permite scripts y estilos en línea (la alternativa con nonce desactiva el prerenderizado parcial) y los orígenes de Mercado Pago son una lista razonable a reconfirmar con la integración real. |
| 12 | Auditoría de dependencias sin vulnerabilidades críticas | Cumple, con aviso | `npm audit --audit-level=critical` pasa (0 críticas). **Aviso:** hay 74 altas y 9 moderadas, casi todas transitivas de Medusa; no se arreglan sin `npm audit fix --force`, que rompe versiones. Ver decisión 2. |
| 13 | Eventos de SEC-95 registrados y sin datos personales en los logs | Cumple, con una excepción | Registrados con usuario, fecha e identificador de solicitud: logins exitosos y fallidos, accesos rechazados por permisos, capturas, reembolsos, cancelaciones y superación de límites. El escenario E2E `07` y el escaneo de la suite buscan 10 datos reconocibles (nombre, teléfono, documento, dirección, CBU, titular, alias, contenido del comprobante) en el log del servidor de producción: 0 coincidencias; el revisor independiente tampoco encontró tokens ni inyección en el log. **Excepción:** "webhooks rechazados por firma inválida" no aplica hasta que exista el webhook (ítem 7). |
| 14 | Túnel temporal cerrado después de cada prueba | Cumple | No se usó ningún túnel: las pruebas con Mercado Pago no se hicieron todavía (SP-02). |

## Hallazgos de las revisiones independientes

**Corregidos** (con prueba): límite de pedidos por IP salteable con `X-Forwarded-For`; carrera en el límite por email; token duplicado al completar un carrito en paralelo; secuencia tarjeta → transferencia que dejaba el carrito sin sesión; el depurador de respuestas rompía los montos; subidas de comprobantes en paralelo salteaban "un comprobante en revisión" y las 5 por hora; enlace firmado maleable (aceptaba firmas de otro largo); IP reenviada sin validar y mapa del limitador sin tope; el cuerpo de los emails se registraba en el log; aceptar un comprobante de un pedido cancelado daba un error genérico; el proveedor de notificaciones de Medusa volcaba CBU, nombre y enlace con token en el log.

**Avisos sin corregir** (el resto se anotó en `odd/tasks/s3-checkout.md` y `s4-transferencias.md`):
- Multer recibe hasta 5 MB en memoria antes de comprobar el token del pedido, por lo que quien no tiene token puede ocupar 5 MB por solicitud concurrente.
- El límite de login es por IP, sin límite por cuenta; `/auth/session` y `/auth/token/refresh` no tienen límite.
- La guarda de `INSECURE_SESSION_COOKIE` mira la URL del backend, no `NODE_ENV`: un despliegue detrás de un proxy TLS con `MEDUSA_BACKEND_URL=http://localhost:…` la dejaría pasar.
- La venta del local no es atómica: una falla entre completar el carrito, capturar y cumplir deja un pedido a medias.
- El token firmado de 15 minutos de los comprobantes queda en la ruta del log HTTP de Medusa.
- La carrera de dos llamadas simultáneas al medio de pago no tiene bloqueo por carrito.
- Tras rotar el código de la promoción, un carrito que ya tenía el viejo conserva su descuento.
- Si falla el guardado del token justo después de crear un pedido, ese pedido queda sin forma de abrirse.
- El vencimiento de un token se extiende si un admin edita un pedido ya cerrado.

## Decisiones pendientes del Product Owner

1. **Webhook y pago con tarjeta (ítems 7 y 8).** No se pueden cumplir hasta tener la cuenta de pruebas de Mercado Pago (SP-02). Opciones: aceptar el MVP0 cerrado solo con transferencias y dejar tarjeta, webhook y conciliación como la siguiente entrega, o no darlo por terminado hasta integrarla.
2. **Dependencias con vulnerabilidades altas (ítem 12).** Aceptar el riesgo mientras sean transitivas de Medusa y revisarlas con cada actualización de Medusa, o pedir que se evalúe una actualización mayor.
3. **Avisos sin corregir.** Los de menor impacto se proponen para el MVP1; si alguno debe corregirse antes de abrir al público, indicarlo.

## 6.2 Requisitos de la etapa de despliegue

Los ítems de `seguridad.md`, sección 6.2, siguen como requisitos (panel de la plataforma con VPN y doble factor; servidor endurecido; secretos de producción nuevos; CORS con dominios exactos, HTTPS con HSTS y cookies `Secure`; buckets para imágenes, comprobantes y respaldos; webhook verificado con notificaciones reales; credenciales de producción de Mercado Pago; restauración de respaldo probada; alertas; auditoría en la integración continua; botón de arrepentimiento y textos legales). Esta revisión suma estos requisitos concretos:

- Declarar `TRUSTED_PROXY_HOPS` con el mismo valor en el backend y el storefront, para que los límites vean a cada cliente por separado.
- Mover el límite de solicitudes y la sesión del panel a Redis (hoy son de memoria y de una sola instancia) o a un límite en el proxy.
- No definir `INSECURE_SESSION_COOKIE` ni `LOG_EMAIL_BODIES` en ningún despliegue.
- Reemplazar el proveedor de notificaciones por el real (TEC-05) sin que registre cuerpos de emails.
- Reemplazar `apps/backend/.env.template` por una plantilla sin secretos de ejemplo.
- Reconfirmar la CSP con el checkout real de Mercado Pago y evaluar los hashes de integridad (SRI) para quitar `unsafe-inline`.
- Ejecutar el script de k6 de la última unidad (`scripts/k6/last-unit.js`) cuando k6 esté instalado.
