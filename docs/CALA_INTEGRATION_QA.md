# Integración de CALA — 8 de noviembre de 2026

Origen: `PMS/PMS`. Destino: `hotelsonador` (Casa Caballo Soñador). Trabajo preparado en una copia aislada y aplicado mediante comparación SHA-256 con el estado inicial, conservando los cambios previos del proyecto y un respaldo de los archivos sustituidos.

## Resultado

- CALA sustituye el panel en `/admin`, con navegación de escritorio y móvil, calendario, reservas, huéspedes, Inbox, tarifas, inventario, operación, finanzas, mercado, informes, permisos y preferencias.
- Los editores existentes de contenido, imágenes, experiencias, talleres, amenidades, comida, tours y Stripe quedan dentro de su navegación. Las rutas antiguas de calendario, reservas e iCal redirigen al módulo correspondiente.
- Supabase Auth verifica identidad, organización activa, membresía y alcance. Las cookies del admin anterior no autorizan acceso. Los editores históricos requieren además un perfil vinculado y acceso a todas las propiedades. El cambio de cuenta recarga el documento para descartar contenido privado previamente renderizado.
- Tablas de CALA en `public`; tablas históricas del sitio en `site`, con rol privado del servidor y RLS. Prisma genera clientes separados sin migrar automáticamente las bases.
- El puente transaccional conecta reservas y bloqueos en ambas direcciones, conserva el precio al mover una estancia, separa extras y alojamiento, mantiene la preparación tras el checkout y protege contra modificaciones obsoletas, borrados con pagos y pagos tardíos que colisionan.
- Las confirmaciones de una estancia y los recibos de procesamiento de Stripe se registran por separado. Los webhooks verifican su firma; los reintentos no duplican pagos. Un pago con conflicto conserva el dinero registrado y requiere revisión, sin asignar inventario ocupado.
- Las notas de las reservas se consultan mediante el RPC protegido. El número de huéspedes que no existía en la web original queda señalado para revisión. La web consulta y vuelve a validar la cotización de CALA antes de cobrar.
- Los enlaces iCal existentes publican fechas del inventario canónico con identificadores opacos. La importación evita bucles de eventos propios y conserva los bloqueos previos ante errores o recurrencias sin expandir.
- La PWA tiene alcance `/admin/`; guarda únicamente recursos públicos, sin cachear páginas privadas ni encolar compras o cambios sin conexión. La web pública conserva sus estilos al entrar y salir del panel.

## Comprobaciones

Node 22.23.3, Next 16.4.5 y Prisma 5.22.0. Las pruebas usan PostgreSQL embebido y datos sintéticos; no se enviaron pagos, correos ni migraciones a servicios reales.

- 78 pruebas del núcleo, PostgreSQL, puente, paginación y PWA.
- 35 pruebas de regresión del sitio, webhooks, calendarios, imágenes y herramientas de migración.
- TypeScript sin errores. ESLint sin errores; el repositorio conserva advertencias de estilo y patrones históricos.
- Compilación de producción y recorrido visual de escritorio/móvil. La prueba de navegador usa el SDK real de Supabase contra un servidor HTTP sintético sobre las migraciones PostgreSQL; no es un modo demo de la aplicación.

Validación final completada en la carpeta `hotelsonador`: 113 pruebas aprobadas, compilación de producción correcta y ESLint con 0 errores (306 advertencias de estilo/patrones existentes). El recorrido de Chrome verificó acceso y cierre de sesión, CSRF, lectura completa del inventario, arrastre confirmado hasta cerrar su diálogo, reflejo de fechas en la web, navegación táctil, manifiesto/PWA, tipografías independientes y navegación completa de vuelta a la web pública. No hubo excepciones del navegador.

El sondeo de la compilación sin configuración verificó la pantalla de preparación, las cabeceras privadas, el manifiesto y el rechazo de APIs y compras que no están listas. Los registros y capturas están en `test-results/site` (ignorados por Git); el respaldo de fuentes se conserva en `PMS/integration/backups/cala-20261109T043556Z/manifest.json`. No se modificaron los archivos `.env` ni los datos reales.

## Activación pendiente

El código no crea un proyecto Supabase remoto, no conoce sus variables y no despliega el sitio. Sigue `docs/SUPABASE_SETUP.md` para importar, crear el usuario, ejecutar el arranque, configurar el rol privado y activar el backend. Antes de eso, las nuevas reservas de alojamiento permanecen cerradas y `/admin` muestra la preparación.

El envío y recepción de mensajes OTA, ARI y los datos de mercado automáticos conservan los límites actuales de CALA: requieren sus proveedores reales. Stripe/Resend/Cloudinary existentes se reutilizan; se deben comprobar sus credenciales, webhook, remitente y cron en el entorno de pruebas. La importación de datos se ensaya primero en un proyecto nuevo y nunca sobre una base ya operativa.
