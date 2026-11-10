# Auditoría de producción — 7 de noviembre de 2026

## Estado

Actualizado el 8 de noviembre de 2026 tras confirmar que el proyecto ya se usa en producción. Las correcciones conservan la estructura existente de la base de datos: **no requieren migración ni cambios en las reservas actuales**. No se publicó ni se modificó la base remota durante esta auditoría. Se conservan Smoobu, Stripe, el diseño y la carga forzada. El usuario confirmó que las variables están configuradas en Vercel; no se exportaron sus valores al entorno local.

## Correcciones realizadas

| Área | Error encontrado | Corrección |
| --- | --- | --- |
| Administración | Acciones de servidor y numerosas API sin autenticación propia; el proxy solo comprobaba que hubiera una cookie | Autorización en cada acción y API, verificación de JWT, validación de usuario y versión de credenciales y protección del layout |
| Sesiones | Cookies inválidas podían entrar en un ciclo entre login y panel; cambiar la contraseña no invalidaba sesiones previas | Login accesible con cookie inválida y revocación por versión de credenciales |
| Facturas y confirmación | Facturas descargables mediante ID y página principal capaz de revelar una reserva sin vincularla a una sesión de pago | Facturas privadas y validación de la correspondencia entre sesión de Stripe e ID de reserva |
| Reenvío de facturas | La comprobación del correo se podía omitir | Correo obligatorio y coincidencia con la reserva; actualización del cliente que solicita el reenvío |
| Stripe | Precios, cantidades y moneda de servicios controlados por el navegador; diferencias entre total guardado y cobro | Precios y nombres del catálogo activo, validación de cantidades, moneda MXN y concordancia de totales |
| Disponibilidad | Las reservas pendientes se eliminaban a los 15 minutos, aunque Stripe podía aceptar su pago después | Sesiones de pago de 30 minutos y retención de 35 minutos; disponibilidad de solo lectura y expiración sin borrar el historial |
| Concurrencia | Comprobar disponibilidad dentro de una transacción no serializaba por sí solo las reservas concurrentes | Bloqueo de la fila de la propiedad en las comprobaciones y altas de alojamiento, incluyendo reservas manuales |
| Webhooks | Errores de base de datos y notificaciones reconocidos como procesados; confirmaciones duplicadas desde páginas GET | Confirmación únicamente desde webhooks, comprobación de pago, respuestas de error que permiten reintentar y notificaciones con claves de idempotencia |
| Pagos de servicios | Solo se confirmaban servicios TOUR y no se conciliaba el importe descontado | Actualización de pagos de servicios y total efectivamente cobrado, incluidos descuentos y pagos sin importe pendiente |
| Fechas | Algunas fechas de calendario y facturas se desplazaban al día anterior al interpretarse en la zona horaria local | Conversión explícita entre días de UTC y días del calendario; fechas de reserva formateadas sin desfase |
| Calendario | Desbloquear un día podía eliminar un rango completo, o afectar bloqueos importados | División de los intervalos y modificación únicamente de bloqueos manuales; normalización de fechas seleccionadas |
| iCal | Guardar fuentes recreaba sus IDs y dejaba bloqueos huérfanos; se descartaban eventos solapados con reservas o bloqueos manuales | Conservación de IDs por URL, eliminación de bloqueos de fuentes retiradas y conservación completa de eventos externos válidos |
| Cron | Contraseña fija de respaldo, aceptación de User-Agent falsificable y workflow que llamaba una ruta inexistente | CRON_SECRET obligatorio mediante cabecera; endpoint de expiración y workflow de mantenimiento corregido |
| Imágenes | El historial de restauración usaba un modelo inexistente; sobrescribir el mismo recurso no preservaba sus versiones | Versiones de imágenes guardadas en el modelo SiteImage existente, sin tablas nuevas, y recursos de Cloudinary únicos para conservar las URLs anteriores |
| Documentos de identidad | Escritura en public/uploads, incompatible con almacenamiento persistente de Vercel y accesible públicamente | Cargas autenticadas en Cloudinary, validación de formato/tamaño y protección de rutas de documentos antiguos |
| Idiomas | Locale no admitido aceptado desde la cookie y HTML que podía presentar el idioma anterior | Idiomas es/en validados, contexto del idioma solicitado y preferencia persistente |
| Modales | Los modales cerrados podían restablecer el scroll de otros modales abiertos | Conteo compartido de bloqueos, restauración del estilo original y limpieza al desmontar |
| SEO | Título duplicado en la página principal y canonical de habitaciones apuntando al inicio | Título sin duplicados, canonical propio y exclusión de indexación para administración y confirmación de pagos |
| Compilación | ignoreBuildErrors ocultaba errores reales de TypeScript | Comprobación estricta restaurada y errores de tipos corregidos |
| Dependencias | Next.js 16.2.9 y varias dependencias afectadas por avisos de seguridad | Next.js/eslint-config-next 16.4.5, actualizaciones compatibles, parches transitivos y Node 22 declarado |

La pantalla inicial conserva sus **1.500 ms mínimos** y su transición de salida de **1.500 ms**. También se conservan las esperas forzadas de cambio de idioma y acciones de reserva. La limpieza de temporizadores no reduce esas duraciones.

## Verificación

- La compilación de producción de la revisión del 7 de noviembre pasó. Después del ajuste de compatibilidad del 8 de noviembre, se intentó repetir con Turbopack y Webpack; ambos procesos quedaron esperando lecturas de archivos en este equipo y se detuvieron. **La compilación de la revisión final queda pendiente de repetir.**
- `npm test`: 31 pruebas correctas, incluidas las pruebas existentes de migración a Smoobu.
- `npm run typecheck`: correcto tras retirar las extensiones de esquema.
- `npm run lint`: la revisión anterior terminó sin errores; la repetición del 8 de noviembre quedó bloqueada en lecturas de archivos junto con la compilación. Persisten advertencias de mantenimiento. Las anotaciones `any` y ciertos patrones de efectos se reportan como advertencias; TypeScript estricto y reglas de corrección siguen activos. Los renderizadores PDF de API están excluidos únicamente de la regla de límites de error de componentes de interfaz.
- `npm audit --omit=dev`: **0 vulnerabilidades conocidas**.
- Navegador Chrome aislado: inicio en español e inglés, habitaciones, tours, comida, talleres, políticas, login y respuesta 404 para idioma no soportado.
- Escritorio 1440 px y móvil 390 px: sin desbordamiento horizontal en el inicio; capturas inspeccionadas.
- Smoobu: formulario real cargado, cierre con botón/Escape y reapertura correctos, sin realizar reservas.
- Solicitudes HTTP: administración y facturas privadas devuelven 401; cron rechaza User-Agent falsificado; inicializaciones no admiten GET; entradas de checkout inválidas devuelven 400.
- No se realizaron cobros, envíos de correo ni escrituras en la base de datos remota.

## Compatibilidad con las reservas actuales

El esquema Prisma coincide con el que tenía el proyecto antes de esta auditoría. Se retiró el SQL preparado anteriormente y **no debe ejecutarse ninguna migración por estos cambios**.

Las notificaciones de pagos usan los estados existentes: PAID conserva una reserva cobrada mientras se reintentan sus correos; CONFIRMED evita repetir los avisos ya completados. Una reserva histórica confirmada no se vuelve a modificar al recibir el mismo evento. No se crean columnas de seguimiento.

El historial de imágenes utiliza registros del modelo SiteImage existente, identificados por un grupo de versiones y excluidos de las imágenes públicas. No modifica registros de reservas ni requiere tablas nuevas.

La expiración y la limpieza de intentos pendientes conservan sus registros. Si Stripe falla al inicializar un nuevo pago, ese intento se marca como fallido. Las funciones de eliminación explícita que ya existían en el panel no se han ejecutado durante la auditoría.

Verificación local:

```sh
nvm use
npm test
npm run typecheck
npm run lint
npm run build
```

No se ejecutó ningún cambio de estructura, reinicio de datos ni limpieza sobre la base remota.

## Configuración del alojamiento

El usuario confirmó que las variables están configuradas en Vercel. La verificación local encuentra DATABASE_URL y CLOUDINARY_URL; las siguientes claves no están copiadas al entorno local:

- JWT_SECRET: secreto aleatorio de al menos 32 caracteres.
- CRON_SECRET: secreto aleatorio de al menos 32 caracteres, igual en el alojamiento y GitHub Secrets.
- STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET.
- RESEND_API_KEY.

Esto no demuestra una ausencia en Vercel; son entornos distintos. `npm run check:production` informa las variables ausentes sin imprimir sus valores.

En GitHub Secrets, el workflow utiliza además PRODUCTION_URL. Su programación es cada cinco minutos; Vercel conserva la sincronización diaria configurada. El webhook debe apuntar a `/api/webhooks/stripe/` y recibir `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`. Confirmar también la autorización del dominio remitente en Resend y las credenciales de Cloudinary para cargas autenticadas.

Las sesiones administrativas antiguas requerirán iniciar sesión de nuevo por la nueva comprobación de versión de credenciales; no modifica las cuentas ni las reservas existentes.

## Límites y deuda pendiente

- El audit completo, incluyendo herramientas de desarrollo, mantiene **42 avisos (17 altos y 25 moderados; 0 críticos)** en las cadenas de Vercel CLI y análisis de código. Ninguno pertenece al conjunto de dependencias de producción. Se aplicaron parches compatibles; no se forzaron cambios mayores de API de Zod, Undici o minimatch que pudieran romper las herramientas. Revisar las actualizaciones coordinadas de esas herramientas antes de dar por cerrado un objetivo de cero avisos en toda la cadena de desarrollo.
- Las advertencias de lint preexistentes incluyen anotaciones `any`, imports sin uso y patrones de efectos. No equivalen a una comprobación completa de la calidad de todos los datos administrativos.
- Los límites de peticiones implementados en memoria se aplican por instancia. Un límite global requiere configuración del alojamiento o almacenamiento compartido.
- Smoobu e iCal sincronizan de forma asíncrona. Las transacciones locales evitan conflictos entre operaciones que usan esta base, pero no pueden garantizar inventario simultáneo con una reserva creada directamente en otro canal antes de sincronizar.
- Faltan las pruebas integrales en un entorno de Stripe de pruebas y la verificación de entrega de correos/cron en el alojamiento. Las claves de producción permanecen en Vercel; no se usaron para generar cobros ni correos durante la auditoría. Los contratos y errores se probaron con dependencias simuladas.
- El historial nuevo de imágenes comienza con las sustituciones posteriores a esta actualización. No reconstruye versiones antiguas que Cloudinary ya hubiera sobrescrito.

## Fuentes de seguridad

- Release oficial de Next.js 16.4.5: https://github.com/vercel/next.js/releases/tag/v16.4.5
- Aviso de seguridad de Next.js: https://github.com/advisories/GHSA-673q-mjm6-r5xr
- Documentación local de la versión instalada en `node_modules/next/dist/docs/` y resultados de npm audit obtenidos durante la revisión.
