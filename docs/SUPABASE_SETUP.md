# CALA en Casa Caballo Soñador

CALA reemplaza `/admin`. La web pública conserva su diseño y usa el formulario propio de reserva. Los editores de imágenes, experiencias, talleres, amenidades, comida y tours, las facturas, Stripe, Resend y Cloudinary se conservan. `/admin/calendar`, `/admin/bookings` y `/admin/ical` redirigen al panel nuevo.

Este código está preparado para conectar Supabase. Instalarlo no migra datos ni despliega la web. Hasta configurar las variables, `/admin` muestra una pantalla de preparación; el contenido de la web puede seguir leyendo su MySQL actual con `DATA_BACKEND=legacy`. Las nuevas reservas de alojamiento permanecen cerradas hasta completar Supabase, para evitar vender con un inventario anterior al cambio.

## 1. Proyecto y acceso

Usa primero un proyecto Supabase de pruebas **nuevo**, PostgreSQL 17, separado de cualquier base con datos importantes. Las migraciones crean las tablas de CALA en `public` y las tablas actuales del sitio en `site`. Prisma no debe gestionar `auth` ni `storage`.

En Authentication desactiva los registros públicos. Crea tu usuario en Authentication → Users, con un correo tuyo y contraseña, y confirma el correo. Copia su UUID. No compartas contraseñas ni claves secretas en chats. El panel no acepta el usuario ni la cookie del admin antiguo.

En Data API deja expuesto únicamente `public`; **no expongas `site` ni `pms_private`**. Mantén RLS habilitado. Las claves `service_role`/`sb_secret_…` no se utilizan en el navegador ni son necesarias para el panel.

## 2. Instalar y aplicar el esquema

En la raíz de `hotelsonador`, con Node 22:

```sh
npm ci
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

La CLI registra las migraciones aplicadas. Comprueba que el proyecto enlazado sea el de pruebas antes del último comando. Si tu versión de la CLI exige destino explícito, usa `--remote` para el proyecto enlazado. No ejecutes `db reset` remoto ni `--include-seed`: `supabase/seed.sql` contiene exclusivamente fixtures de pruebas. Consulta la [referencia oficial de migraciones](https://supabase.com/docs/reference/cli/introduction).

La alternativa es ejecutar en SQL Editor los archivos de `supabase/migrations` **una sola vez, por orden de nombre**. No combines después ambos métodos sin conciliar primero el historial de migraciones. No uses `prisma db push` ni `prisma migrate dev` sobre Supabase.

## 3. Conservar los datos existentes

Antes del cambio definitivo, detén temporalmente las nuevas ventas y escrituras administrativas; mantén procesando los webhooks pendientes de Stripe. Haz una copia de seguridad de MySQL y de los archivos privados. Conserva las URL de Cloudinary y los archivos locales existentes: cambiar la base no copia el contenido binario de `uploads`.

Con el `DATABASE_URL` MySQL actual en tu entorno:

```sh
npm run db:export
npm run db:validate -- --input .supabase-migration/EL_ARCHIVO.json
npm run db:import -- --input .supabase-migration/EL_ARCHIVO.json
```

El último comando solo valida el archivo, sin conectar a una base. El export está protegido con permisos privados e incluye datos de huéspedes: no lo subas a Git ni lo publiques. Conserva también el respaldo original de MySQL.

Ejecuta estos pasos uno por uno y continúa solo si el anterior termina correctamente. Si falla la exportación, el archivo todavía no existe y fallarán también la validación y la importación. El script informa códigos seguros como `ENOENT` (archivo ausente), `EEXIST` (respaldo ya existente), `P1000` (credenciales) o `P1001` (conexión); no imprime contraseñas, consultas ni datos de huéspedes. Si el respaldo ya existe, valídalo o usa otro `--name` para una exportación nueva; no lo borres para resolver el error.

Configura **localmente** `SUPABASE_DIRECT_URL` con la conexión de propietario/migración de Supabase, copiada del diálogo Connect (directa o Session pooler si necesitas IPv4), con `schema=site&sslmode=require`. Después importa explícitamente:

```sh
npm run db:import -- --input .supabase-migration/EL_ARCHIVO.json --apply
```

La importación usa una transacción, conserva los IDs, comprueba duplicados y reajusta las secuencias. Un reintento idéntico antes del arranque no duplica datos; si el destino difiere, se detiene. Una base ya inicializada en CALA no se sobrescribe. No se envían correos, cobros ni solicitudes a Smoobu. Para empezar vacío puedes omitir esta sección.

## 4. Vincular tu usuario y el alojamiento

Ejecuta como propietario en SQL Editor, sustituyendo el UUID por el usuario de Authentication:

```sql
select site.bootstrap_cala('UUID_DE_TU_USUARIO_AUTH'::uuid);
```

Devuelve `organizationId`, `defaultPropertyId` y los conteos importados. Guarda los dos UUID para las variables de entorno. El arranque crea una organización y mapea cada alojamiento existente a una villa completa con su capacidad y precio reales. No convierte la capacidad de doce huéspedes en doce habitaciones. Si no importaste datos, crea la villa base para que puedas configurar sus datos reales antes de vender.

Revisa `openAlerts`, los conteos y los importes. La web original no guardaba el número de huéspedes: las reservas importadas o creadas por ese formulario muestran un adulto provisional y una nota para que confirmes su ocupación en CALA. Los contactos, notas originales, fechas e importes se conservan. Las reservas pendientes de la web con más de 35 minutos se marcan expiradas; los pagos históricos se etiquetan `legacy_import`, sin afirmar que fueron verificados por Stripe. Los bloqueos inclusivos se convierten a intervalos exclusivos y se conserva la noche de preparación tras cada salida. Un conflicto se debe revisar antes de abrir ventas.

Puedes comprobar sin exponer contactos:

```sql
select 'reservas_web' as tabla,count(*) from site.reservas
union all select 'reservas_cala',count(*) from pms_private.site_booking_map
union all select 'bloqueos_web',count(*) from site.blocked_dates
union all select 'alertas_abiertas',count(*) from site.integration_alerts where status='open';
```

No repitas una importación de MySQL después de empezar a operar en CALA. El arranque se puede repetir para comprobar mappings; no sirve para fusionar dos sistemas operando a la vez.

## 5. Conexión privada del servidor

Las migraciones crean `cala_site_app` sin permiso de inicio de sesión. Como propietario, asigna una contraseña larga y exclusiva en SQL Editor:

```sql
alter role cala_site_app login password 'TU_CONTRASEÑA_PRIVADA_NUEVA';
alter role cala_site_app set timezone to 'UTC';
```

No guardes esta instrucción con la contraseña en el repositorio. Para `SUPABASE_DATABASE_URL`, copia el host del diálogo Connect, modo Session pooler, puerto 5432, y cambia el usuario por `cala_site_app.TU_PROJECT_REF`. Usa la contraseña del rol, codificada para URL, y añade `schema=site&sslmode=require&connection_limit=1`. Una conexión directa usa el usuario `cala_site_app` sin sufijo. [Supabase documenta los hosts, puertos y usuarios de cada modo](https://supabase.com/docs/guides/database/connecting-to-postgres).

El rol privado accede a `site` y a funciones concretas del puente; no tiene acceso general a las tablas de CALA. El panel utiliza el JWT del usuario y las políticas de Supabase, con comprobación de membresía en cada petición. Los editores antiguos y facturas requieren además `AdminUser.supabase_user_id` y acceso a todas las propiedades; el arranque vincula al propietario. No concedas un perfil de editor global a personal limitado a una propiedad.

## 6. Variables y prueba de producción

Completa `.env.local` y después las variables del entorno Preview/Production del hosting, tomando `.env.example` como referencia:

```dotenv
DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
SUPABASE_DATABASE_URL=TU_CONEXION_PRIVADA_DEL_ROL_CALA_SITE_APP
CALA_ORGANIZATION_ID=UUID_DEVUELTO_POR_BOOTSTRAP
CALA_DEFAULT_PROPERTY_ID=UUID_DEVUELTO_POR_BOOTSTRAP
```

También se acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY` para proyectos con clave `anon`. `SUPABASE_DIRECT_URL` pertenece a herramientas locales de migración; **no la pongas en el hosting de la app**. Configura también `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, las variables del remitente de correo, `CLOUDINARY_URL` y `CRON_SECRET`; conserva sus valores válidos si ya los tienes. La comprobación de esta entrega detectó pendientes las claves de Stripe/Resend y el cron, además de Supabase. El `JWT_SECRET` y `ADMIN_DEFAULT_PASSWORD` antiguos ya no autorizan acceso.

```sh
npm run check:production
npm run typecheck
npm run test:integration
npm run build
npm start -- --port 3001
```

Abre `/admin/` e inicia sesión con tu usuario de Supabase. Desde móvil usa el menú de instalación de CALA o “Añadir a pantalla de inicio” del navegador. La PWA tiene alcance `/admin/`, interfaz móvil propia y aviso sin conexión. No almacena páginas privadas ni confirma operaciones sin internet. La instalación y algunas capacidades dependen del navegador; comprueba Safari en iOS y Chrome en Android con dispositivos físicos.

En pruebas usa claves y tarjetas de **Stripe Test**, remitentes y destinatarios que controles. Comprueba: compra en la web → reserva en CALA → mover fechas/unidad → web bloqueada → cancelar → disponibilidad liberada. Comprueba también restricciones de tarifa, extras, comprobante, correo, pago repetido y pago tardío. Este último queda en borrador, conserva el pago en Finanzas y aparece en **Revisión de pagos** si las fechas ya se ocuparon. Resolver la estancia no emite automáticamente un reembolso.

Mantén el webhook de Stripe en `/api/webhooks/stripe/` y configura los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`. Programa `/api/cron/expire-pending/` cada pocos minutos y `/api/cron/ical/` con la frecuencia admitida por tu hosting; ambos requieren `Authorization: Bearer CRON_SECRET`. Sin cron, una retención puede permanecer bloqueada por seguridad. Los enlaces iCal existentes leen ahora el inventario de CALA y publican solo eventos ocupados con IDs opacos; los enlaces nuevos privados se crean en Canales. La importación omite eventos propios para evitar bucles y rechaza recurrencias sin fechas expandidas, conservando los bloqueos anteriores si falla. Los calendarios externos existentes se gestionan desde el menú de CALA; abrir la pantalla no sincroniza por sí solo.

## Alcance de las conexiones

El inventario y las tarifas se validan en la base, con bloqueos por propiedad, versiones y auditoría. La villa vinculada usa su única unidad; para vender habitaciones o villas por separado se debe definir primero el inventario y sus exclusiones, sin duplicar la venta de la casa completa. Las propiedades nuevas creadas en CALA no aparecen automáticamente como productos en la web.

Stripe, comprobantes y correos transaccionales de la web se conservan; las imágenes mantienen Cloudinary. El Inbox, las estadísticas, el estudio de mercado y las herramientas de CALA se han copiado con sus capacidades actuales. El envío/recepción de mensajes OTA, ARI y datos de mercado automáticos necesitan acuerdos y adaptadores de los proveedores; iCal solo transmite disponibilidad. La interfaz no simula esas conexiones. Los exports de Smoobu del trabajo anterior y `smoobu:migrate` quedan como antecedentes; no ejecutes esa migración para este cambio.

## Corte y reversión

Cuando las pruebas pasen: pausa ventas/escrituras, procesa pendientes, exporta la última instantánea, repite la importación y conciliación en la base final nueva, ejecuta el arranque, cambia las variables y despliega. Cambiar variables locales no modifica automáticamente Vercel ni tu dominio. Reabre ventas solo cuando ambos lados muestren las mismas estancias.

Antes de recibir nuevas reservas, puedes volver a la versión anterior de fuentes y a MySQL. Después de operar en Supabase, volver únicamente al código anterior perdería de vista las nuevas operaciones: detén escrituras, respalda Supabase y concilia las reservas/pagos antes de una reversión. No borres la base original durante las pruebas.
