/**
 * English catalog for CALA (part 2). Keys are the Spanish source strings as
 * they appear in components, notifications and server messages. Merged into
 * the main dictionary in i18n.tsx and also used by the DOM translator, so
 * strings rendered without t() are translated too.
 */
export const catalog: Record<string, string> = {
  // Notifications & server messages
  "Cargo registrado": "Charge recorded",
  "Pago en proceso": "Payment in progress",
  "Nota interna guardada": "Internal note saved",
  "Borrador guardado": "Draft saved",
  "Mensaje preparado, pendiente de conexión":
    "Message prepared, waiting for a connection",
  "Mensaje guardado sin enviar. Conecta un proveedor de mensajería para entregarlo.":
    "Message saved without sending. Connect a messaging provider to deliver it.",
  "En cola": "Queued",
  "Revisión confirmada. Importación en cola":
    "Review confirmed. Import queued",
  "Casa completa": "Entire house",
  "Unidad estándar": "Standard unit",
  "Cama en dormitorio": "Bed in dorm",
  "Dormitorio completo": "Entire dorm",
  "Dormitorio A": "Dorm A",
  Cama: "Bed",
  "Tarifa flexible": "Flexible rate",
  "Sólo el propietario puede asignar administradores.":
    "Only the owner can appoint administrators.",
  "Sólo puedes asignar roles por debajo del tuyo.":
    "You can only assign roles below your own.",
  "Sólo puedes gestionar roles por debajo del tuyo.":
    "You can only manage roles below your own.",
  "Miembro creado": "Member created",
  "No se envió correo. Esta cuenta sólo existe en desarrollo.":
    "No email was sent. This account only exists in development.",
  "sin asignar": "unassigned",
  "Reserva actualizada": "Reservation updated",
  "Calendario importado": "Calendar imported",
  "No pudimos completar la importación.": "We couldn't complete the import.",
  "Importación pendiente de reintento": "Import waiting to retry",
  "Revisa la importación": "Review the import",
  "Los eventos ausentes del archivo no se eliminan; una cancelación debe ser explícita.":
    "Events missing from the file are not deleted; a cancellation must be explicit.",
  "Estancia importada": "Imported stay",
  "Ya existe una tarifa para esta fecha.": "A rate already exists for this date.",
  "Reconecta canales y pagos con sus proveedores autorizados.":
    "Reconnect channels and payments with their authorized providers.",
  "Cargando espacio de trabajo": "Loading workspace",
  "Tu propiedad, cada vez más completa": "Your property, more complete every day",
  "Los servicios de producción pendientes no impiden probar la operación local.":
    "Pending production services don't prevent testing local operations.",
  "Cambios guardados": "Changes saved",
  "Alojamiento actualizado": "Accommodation updated",
  "Unidad actualizada": "Unit updated",
  "Propiedad actualizada": "Property updated",
  "Miembro añadido al equipo": "Member added to the team",
  "Acceso actualizado": "Access updated",
  "Miembro retirado del equipo": "Member removed from the team",
  "Miembro añadido. Ya puede iniciar sesión con su correo y la contraseña temporal.":
    "Member added. They can sign in now with their email and the temporary password.",
  "Miembro añadido. Le enviamos un correo para activar su cuenta.":
    "Member added. We emailed them a link to activate their account.",
  "Esa persona ya tenía cuenta: conserva su contraseña actual.":
    "That person already had an account: they keep their current password.",
  "Esta persona ya pertenece al equipo.": "This person is already on the team.",
  "No se encontró la cuenta de esa persona. Vuelve a enviar la invitación.":
    "We couldn't find that person's account. Send the invitation again.",
  "No puedes cambiar ni retirar tu propio acceso.":
    "You can't change or remove your own access.",
  "El propietario no se modifica desde Equipo; la transferencia requiere un proceso aparte.":
    "The owner can't be changed from Team; a transfer needs a separate process.",
  "Elige un rol válido.": "Choose a valid role.",
  "Elige propiedades de esta organización.":
    "Choose properties from this organization.",
  "Ya existe una unidad con ese nombre en la propiedad.":
    "A unit with that name already exists in this property.",
  "Elige un tipo de alojamiento de esta propiedad.":
    "Choose an accommodation type from this property.",
  "El registro ya no existe. Recarga la vista.":
    "This record no longer exists. Reload the view.",
  "Esta noche de preparación se gestiona con la reserva. Cambia o cancela la estancia para actualizarla.":
    "This preparation night is managed with the reservation. Change or cancel the stay to update it.",
  "La web vende esta villa completa. Utiliza su unidad vinculada; las habitaciones necesitan una configuración de inventario específica.":
    "The website sells this entire villa. Use its linked unit; rooms need a specific inventory setup.",
  "Otra persona actualizó este registro. Recarga y revisa el cambio antes de guardar.":
    "Someone else updated this record. Reload and review the change before saving.",
  "El mensaje cambió o ya no es un borrador editable. Recarga la conversación.":
    "The message changed or is no longer an editable draft. Reload the conversation.",
  "La unidad o un espacio relacionado ya está ocupado o bloqueado en alguna noche de la estancia.":
    "The unit or a related space is already occupied or blocked on a night of the stay.",
  "No hay disponibilidad para todas las noches de la estancia.":
    "There's no availability for every night of the stay.",
  "La habitación de destino necesita limpieza antes del traslado.":
    "The destination room needs cleaning before the move.",
  "Una estancia en casa solo puede cambiar de unidad conservando sus fechas.":
    "An in-house stay can only change units while keeping its dates.",
  "El traslado conserva el número de noches. Edita la reserva para cambiar la duración.":
    "A move keeps the number of nights. Edit the reservation to change its length.",
  "La estancia ya está en esa unidad y esas fechas.":
    "The stay is already in that unit on those dates.",
  "Selecciona una unidad activa de esta propiedad.":
    "Select an active unit in this property.",
  "El plan y el tipo de inventario deben pertenecer a esta propiedad.":
    "The rate plan and inventory type must belong to this property.",
  "La estancia no cumple las restricciones de la tarifa de destino.":
    "The stay doesn't meet the destination rate's restrictions.",
  "El folio está cerrado o falta el cargo de alojamiento. Revísalo antes de recalcular.":
    "The folio is closed or the accommodation charge is missing. Review it before recalculating.",
  "La moneda de las observaciones debe coincidir con la propiedad.":
    "The observations' currency must match the property.",
  "La fecha de observación de mercado no puede ser futura.":
    "The market observation date can't be in the future.",
  "El lote contiene observaciones duplicadas.":
    "The batch contains duplicate observations.",
  "La plantilla contiene una variable desconocida. Revisa las variables disponibles.":
    "The template contains an unknown variable. Check the available variables.",
  "La fecha de envío solicitada debe estar en el futuro.":
    "The requested send date must be in the future.",
  "La reserva ya no está activa; puedes añadir una nota interna.":
    "The reservation is no longer active; you can add an internal note.",
  "Elige un canal compatible con el asistente de conexión.":
    "Choose a channel supported by the connection assistant.",
  "Revisa el modo de sincronización del canal.":
    "Check the channel's sync mode.",
  "Cada vínculo necesita un alojamiento, una tarifa de esta propiedad y el ID del anuncio.":
    "Each link needs an accommodation, a rate from this property and the listing ID.",
  "Cada alojamiento y cada ID del canal solo puede vincularse una vez.":
    "Each accommodation and channel ID can only be linked once.",
  "Tu acceso no permite esta operación. Revisa la propiedad y tus permisos.":
    "Your access doesn't allow this action. Check the property and your permissions.",
  "No se pudo guardar. Revisa el estado, los permisos y la disponibilidad.":
    "Couldn't save. Check the status, permissions and availability.",
  "Solicitud inválida.": "Invalid request.",
  "Revisa los campos indicados.": "Check the highlighted fields.",
  "No pudimos completar la operación. Inténtalo de nuevo.":
    "We couldn't complete the action. Please try again.",
  "No pudimos completar la operación.": "We couldn't complete the action.",
  "No se pudo completar la operación.": "The action couldn't be completed.",
  "No se pudo completar la lectura.": "The read couldn't be completed.",
  "Los datos cambiaron durante la lectura. Vuelve a cargar.":
    "The data changed while reading. Reload.",
  "El espacio supera el límite de consulta. Contacta al administrador.":
    "The workspace exceeds the query limit. Contact your administrator.",
  "Proceso en curso": "Process running",
  "Operación registrada": "Action recorded",
  "Cloudbeds requiere acceso API verificado, configuración y pruebas de contrato.":
    "Cloudbeds needs verified API access, setup and contract testing.",
  "Los adaptadores de desarrollo están bloqueados en este entorno. Configura los adaptadores de producción.":
    "Development adapters are blocked in this environment. Configure production adapters.",
  "El almacenamiento local sólo está disponible en loopback.":
    "Local storage is only available on loopback.",
  "La solicitud no procede de este sitio.":
    "The request didn't come from this site.",
  "Ya no tienes acceso a esta propiedad. Actualiza la vista.":
    "You no longer have access to this property. Refresh the view.",
  "Cambios guardados. No pudimos actualizar la vista; recarga para verlos.":
    "Changes saved. We couldn't refresh the view; reload to see them.",
  "Conéctate para cambiar de propiedad y cargar sus datos actuales.":
    "Go online to switch property and load its current data.",
  "No se pudo cambiar de propiedad.": "Couldn't switch property.",
  "Cerrar aviso": "Dismiss",
  "Sin conexión. Vuelve a conectarte antes de guardar; este cambio no se ha enviado.":
    "You're offline. Reconnect before saving; this change wasn't sent.",
  "Inicia sesión para continuar.": "Sign in to continue.",
  "Tu rol no permite esta operación.": "Your role doesn't allow this action.",
  "No tienes acceso a esta organización.":
    "You don't have access to this organization.",
  "No tienes acceso a esta propiedad.": "You don't have access to this property.",
  "El registro está cerrado. Pide a tu equipo que te invite desde Equipo y permisos.":
    "Sign-up is closed. Ask your team to invite you from Team & permissions.",
  Anfitrión: "Host",
  anfitrión: "host",

  // Channels / OTA assistant
  "Abrir Airbnb (anfitrión)": "Open Airbnb (host)",
  "Tienes una cuenta de anfitrión con al menos un anuncio publicado.":
    "You have a host account with at least one published listing.",
  "En Airbnb: Cuenta → Configuración profesional → Software de terceros. Ahí autorizarás a CALA cuando el conector esté activo.":
    "In Airbnb: Account → Professional hosting tools → Third-party software. You'll authorize CALA there once the connector is live.",
  "Copia el número de cada anuncio: aparece en la URL airbnb.com/rooms/«número».":
    "Copy each listing number: it appears in the URL airbnb.com/rooms/«number».",
  "Correo o ID de anfitrión": "Email or host ID",
  "El correo con el que entras a Airbnb o tu ID de anfitrión (perfil → URL).":
    "The email you use for Airbnb or your host ID (profile → URL).",
  "ID del anuncio": "Listing ID",
  "Solo números, tal como aparece en airbnb.com/rooms/…":
    "Numbers only, as shown in airbnb.com/rooms/…",
  "Abrir Extranet de Booking.com": "Open the Booking.com Extranet",
  "Tienes acceso de administrador a la Extranet de tu alojamiento.":
    "You have admin access to your property's Extranet.",
  "En la Extranet: Cuenta → Proveedor de conectividad. Busca a tu proveedor y acepta los términos cuando el conector esté activo.":
    "In the Extranet: Account → Connectivity provider. Find your provider and accept the terms once the connector is live.",
  "Anota el ID de tu alojamiento (arriba en la Extranet) y el ID de cada tipo de habitación (Propiedad → Detalles de las habitaciones).":
    "Note your property ID (top of the Extranet) and each room type ID (Property → Room details).",
  "ID del alojamiento (Hotel ID)": "Property ID (Hotel ID)",
  "Número de 6 a 9 dígitos que aparece junto al nombre en la Extranet.":
    "A 6–9 digit number shown next to the name in the Extranet.",
  "ID del tipo de habitación": "Room type ID",
  "Número del tipo de habitación en la Extranet.":
    "The room type number in the Extranet.",
  "Abrir Expedia Partner Central": "Open Expedia Partner Central",
  "Tienes acceso a Expedia Partner Central como administrador.":
    "You have admin access to Expedia Partner Central.",
  "En Partner Central: Configuración → Proveedor de conectividad. Solicita el cambio cuando el conector esté activo.":
    "In Partner Central: Settings → Connectivity provider. Request the change once the connector is live.",
  "Anota el Property ID y el ID de cada tipo de habitación (Habitaciones y tarifas).":
    "Note the Property ID and each room type ID (Rooms and rates).",
  "Número que aparece en la parte superior de Partner Central.":
    "The number shown at the top of Partner Central.",
  "Número del tipo de habitación en Partner Central.":
    "The room type number in Partner Central.",
  "Abrir panel de Vrbo": "Open the Vrbo dashboard",
  "Tienes una cuenta de propietario con el anuncio activo.":
    "You have an owner account with an active listing.",
  "En Vrbo: Configuración → Software de gestión. Ahí autorizarás la conexión cuando el conector esté activo.":
    "In Vrbo: Settings → Management software. You'll authorize the connection there once the connector is live.",
  "Copia el número de cada anuncio (aparece en la URL vrbo.com/«número»).":
    "Copy each listing number (it appears in the URL vrbo.com/«number»).",
  "Correo de la cuenta": "Account email",
  "El correo con el que gestionas tus anuncios.":
    "The email you manage your listings with.",
  "Números (y puntos) tal como aparecen en la URL del anuncio.":
    "Numbers (and dots) as shown in the listing URL.",
  "Abrir Google Hotel Center": "Open Google Hotel Center",
  "Tu alojamiento aparece en Google Maps y tienes acceso a Hotel Center.":
    "Your property appears on Google Maps and you have Hotel Center access.",
  "En Hotel Center: Configuración → Socios de conectividad. Vincula a tu proveedor cuando el conector esté activo.":
    "In Hotel Center: Settings → Connectivity partners. Link your provider once the connector is live.",
  "Anota el ID de propiedad de Hotel Center.": "Note the Hotel Center property ID.",
  "ID de Hotel Center": "Hotel Center ID",
  "Identificador de tu cuenta en Google Hotel Center.":
    "Your account identifier in Google Hotel Center.",
  "ID de la unidad": "Unit ID",
  "Identificador de la habitación o unidad en Hotel Center.":
    "The room or unit identifier in Hotel Center.",
  "Abrir Tripadvisor Owners": "Open Tripadvisor Owners",
  "Eres propietario verificado del alojamiento en Tripadvisor.":
    "You're the verified owner of the property on Tripadvisor.",
  "En Tripadvisor Owners: Gestionar → Conectividad. Elige a tu proveedor cuando el conector esté activo.":
    "In Tripadvisor Owners: Manage → Connectivity. Choose your provider once the connector is live.",
  "Copia el ID del alojamiento (la «d» seguida de números en la URL).":
    "Copy the property ID (the «d» followed by numbers in the URL).",
  "ID del alojamiento": "Property ID",
  "Aparece en la URL: …-d1234567-…": "It appears in the URL: …-d1234567-…",
  "Número de la unidad o habitación en Tripadvisor.":
    "The unit or room number on Tripadvisor.",
  Directa: "Direct",
  Conectar: "Connect",
  Descubrir: "Discover",
  Extraer: "Extract",
  Normalizar: "Normalize",
  "Preparar staging": "Prepare staging",
  Validar: "Validate",
  Revisión: "Review",
  Importar: "Import",
  Reconciliar: "Reconcile",
  Verificar: "Verify",
  Completar: "Complete",
  "Datos de propiedad": "Property details",
  "Inventario y unidades": "Inventory and units",
  Tarifas: "Rates",
  "Políticas e impuestos": "Policies and taxes",
  "Disponibilidad inicial": "Initial availability",
  "Pagos de producción": "Production payments",
  "Canales de producción": "Production channels",
  "Reportes operativos": "Operational reports",
  "Prepara tu cuenta": "Prepare your account",
  "Identifica la cuenta": "Identify the account",
  "Vincula alojamientos": "Link accommodations",
  Preferencias: "Preferences",
  "Verificar y activar": "Verify and activate",
  "alojamiento vinculado": "accommodation linked",
  "alojamientos vinculados": "accommodations linked",
  "Tarifas asignadas a cada alojamiento": "Rates assigned to each accommodation",
  "Bandeja de mensajes centralizada lista": "Centralized inbox ready",
  "Permisos de canal comprobados": "Channel permissions checked",
  "No se pudo conectar.": "Couldn't connect.",
  "Asistente de conexión": "Connection assistant",
  "Conectar un canal requiere el permiso «Gestionar canales». Pide a un administrador de la cuenta que complete el asistente.":
    "Connecting a channel needs the «Manage channels» permission. Ask an account administrator to complete the assistant.",
  "Asistente de conexión de canales": "Channel connection assistant",
  "quedó conectado en CALA": "is now connected in CALA",
  "Registramos la cuenta y": "We registered the account and",
  "se agrupan en esta bandeja.": "are grouped in this inbox.",
  "Autoriza a CALA en": "Authorize CALA in",
  "Cuando el conector del proveedor esté disponible, acepta la solicitud en":
    "When the provider's connector is available, accept the request in",
  "Mientras tanto": "Meanwhile",
  ", las respuestas que envíes quedan en cola con estado «Pendiente de entrega»; nada se envía sin la autorización.":
    ", replies you send stay queued as «Pending delivery»; nothing is sent without authorization.",
  "Primera sincronización:": "First sync:",
  "verás la fecha en Canales cuando el proveedor confirme el acceso.":
    "you'll see the date in Channels once the provider confirms access.",
  "Ir a la bandeja": "Go to inbox",
  Progreso: "Progress",
  "¿Qué canal quieres conectar?": "Which channel do you want to connect?",
  "Centraliza reservas y mensajes de tus OTAs en CALA. Puedes conectar varios, uno a la vez.":
    "Bring your OTA reservations and messages into CALA. You can connect several, one at a time.",
  "Conectado · reconfigurar": "Connected · reconfigure",
  "Sin conectar": "Not connected",
  "Prepara tu cuenta de": "Prepare your account on",
  "Marca cada paso cuando lo tengas listo. Puedes cerrar el asistente: guardamos tu avance en este dispositivo.":
    "Tick each step when it's ready. You can close the assistant: we save your progress on this device.",
  "Completa los tres pasos para continuar.": "Complete the three steps to continue.",
  "Identifica tu cuenta": "Identify your account",
  "Formato correcto.": "Format looks right.",
  "Vincula tus alojamientos": "Link your accommodations",
  "Relaciona cada tipo de alojamiento de CALA con su":
    "Match each CALA accommodation type with its",
  "Primero crea un tipo de alojamiento en Inventario.":
    "First create an accommodation type in Inventory.",
  "Crea un plan de tarifas en Tarifas para poder vincular.":
    "Create a rate plan in Rates to be able to link.",
  "unidades · hasta": "units · up to",
  huéspedes: "guests",
  Tarifa: "Rate",
  "Activa al menos un alojamiento.": "Turn on at least one accommodation.",
  "Cada ID del canal solo puede usarse una vez.":
    "Each channel ID can only be used once.",
  "¿Cómo trabajará la conexión?": "How will the connection work?",
  "Mensajes centralizados": "Centralized messages",
  "Siempre activo": "Always on",
  "Qué se sincroniza": "What syncs",
  "Reservas, disponibilidad y precios": "Reservations, availability and prices",
  "Recomendado: CALA recibe las reservas y publica calendario y tarifas.":
    "Recommended: CALA receives reservations and publishes calendar and rates.",
  "Solo disponibilidad y precios": "Availability and prices only",
  "Las reservas se siguen gestionando en el canal.":
    "Reservations are still managed in the channel.",
  "CALA manda": "CALA leads",
  "Los cambios de calendario y precio se hacen en CALA y se publican al canal.":
    "Calendar and price changes are made in CALA and published to the channel.",
  "CALA solo lee; no publica cambios hasta que lo cambies.":
    "CALA only reads; it doesn't publish changes until you switch this.",
  Alojamientos: "Accommodations",
  "Conectando…": "Connecting…",
  "Verificando…": "Verifying…",
  "Activar conexión": "Activate connection",
  "Canales conectados": "Connected channels",
  "Reconfigurar conexión": "Reconfigure connection",
  Sincronizado: "Synced",
  "Esperando autorización": "Waiting for authorization",
  "Conectar canal": "Connect channel",
  "DISTRIBUCIÓN, BAJO CONTROL": "DISTRIBUTION, UNDER CONTROL",
  "Conexiones, mappings y sincronización en un mismo lugar.":
    "Connections, mappings and sync in one place.",
  "· Distribución ARI": "· ARI distribution",
  Mappings: "Mappings",
  "Fuente de verdad": "Source of truth",
  Canal: "Channel",
  "Última sincronización": "Last sync",
  "Sin sincronizar": "Not synced",
  "Sin canales conectados": "No connected channels",
  "Las conexiones disponibles para tu cuenta aparecerán aquí.":
    "Connections available to your account will appear here.",
  "Compartir disponibilidad": "Share availability",
  "Calendario público para tu web y enlace iCal por unidad, sin nombres de huéspedes ni tarifas.":
    "A public calendar for your website and an iCal link per unit, without guest names or rates.",
  "En desarrollo, los enlaces funcionan sólo en este equipo.":
    "In development, links only work on this computer.",
  "La importación acepta archivos de día completo, sin recurrencias.":
    "Import accepts all-day files without recurrences.",
  "Unidad del calendario": "Calendar unit",
  "Crear / rotar enlace privado": "Create / rotate private link",
  "Revocar enlace": "Revoke link",
  "Importar iCal": "Import iCal",
  "Los calendarios externos (iCal) de cada unidad se importan aquí. Los enlaces que ya existían siguen sincronizando automáticamente.":
    "Each unit's external (iCal) calendars are imported here. Existing links keep syncing automatically.",
  "Importación en cola": "Import queued",
  "Ver proceso de importación": "View import process",
  "Este enlace concede acceso al calendario de esta unidad. Puedes revocarlo en cualquier momento. Rotar o revocar invalida tanto iCal como el calendario público de esta unidad.":
    "This link grants access to this unit's calendar. You can revoke it at any time. Rotating or revoking invalidates both iCal and this unit's public calendar.",
  "Descargar calendario privado": "Download private calendar",
  "Enlace privado": "Private link",
  "Idioma del calendario público": "Public calendar language",
  "Enlace del calendario público": "Public calendar link",
  "Código para incrustar": "Embed code",
  "Comparte únicamente con las personas o webs que elijas. Muestra ocupación de dos años anteriores y posteriores. Las reservas sin unidad asignada pueden hacer que se muestre menos disponibilidad hasta asignarlas.":
    "Share only with the people or sites you choose. It shows occupancy two years back and ahead. Reservations without a unit may show less availability until they're assigned.",
  "Abrir calendario público": "Open public calendar",
  "Importar calendario iCal": "Import iCal calendar",
  "Se crearán bloqueos de inventario. Se rechazan conflictos con reservas existentes. Usa el mismo nombre de calendario al actualizarlo.":
    "Inventory blocks will be created. Conflicts with existing reservations are rejected. Use the same calendar name when updating it.",
  "Nombre estable del calendario": "Stable calendar name",
  "Contenido del archivo .ics": ".ics file content",
  "Revisar e importar": "Review and import",
  "Agente de importación": "Import agent",
  "Detalle del proceso": "Process details",
  "% · intento": "% · attempt",
  "Progreso del proceso": "Process progress",
  Incluir: "Include",
  Registro: "Record",
  Tipo: "Type",
  "Estado / observación": "Status / note",
  "Aprobar e importar registros incluidos": "Approve and import included records",
  "Reintentar proceso": "Retry process",
  "filas listas para descargar.": "rows ready to download.",
  "Descargar CSV": "Download CSV",
  "Descargar reporte técnico": "Download technical report",
  "TODO SIGUE SU CURSO": "EVERYTHING KEEPS MOVING",
  "Tus procesos continúan aunque cambies de pantalla o cierres el navegador.":
    "Your processes continue even if you switch screens or close the browser.",
  "Importación iCal": "iCal import",
  "Importación de información": "Data import",
  "Sincronización de canal": "Channel sync",
  "Generación de reporte": "Report generation",
  Pago: "Payment",
  Automatización: "Automation",
  "Sin procesos por ahora": "No processes for now",
  "Las importaciones, sincronizaciones, pagos y reportes aparecerán aquí.":
    "Imports, syncs, payments and reports will appear here.",
  "Auditoría de operaciones": "Operations audit",
  "Aún no hay cambios registrados. Cada acción del equipo aparecerá aquí con su autor y hora.":
    "No changes recorded yet. Every team action will appear here with its author and time.",
  Libre: "Free",
  "No disponible": "Unavailable",
  "Fuera de cobertura": "Outside coverage",
  Disponibilidad: "Availability",
  "Confirma disponibilidad con el alojamiento al reservar.":
    "Confirm availability with the property when booking.",
  "Calendario de disponibilidad": "Availability calendar",
  "Mes anterior": "Previous month",
  "Mes siguiente": "Next month",
  Lun: "Mon",
  Mar: "Tue",
  Mié: "Wed",
  Jue: "Thu",
  Vie: "Fri",
  Sáb: "Sat",
  Dom: "Sun",
  "Última consulta": "Last checked",
  "Actualizar disponibilidad": "Refresh availability",

  // Rates
  "Importe no válido": "Invalid amount",
  "PRECIO CORRECTO, CADA NOCHE": "THE RIGHT PRICE, EVERY NIGHT",
  "Pulsa un precio para cambiar esa noche. Pulsa el nombre de un alojamiento para sus reglas y ajustes.":
    "Tap a price to change that night. Tap an accommodation's name for its rules and settings.",
  "Nuevo plan": "New plan",
  Mes: "Month",
  Hoy: "Today",
  Leyenda: "Legend",
  Cerrado: "Closed",
  "Sin llegadas": "No arrivals",
  "Sin salidas": "No departures",
  "Estancia mínima": "Minimum stay",
  "Aún no hay tarifas que mostrar": "No rates to show yet",
  "Crea un alojamiento en Inventario y un plan de tarifas para empezar.":
    "Create an accommodation in Inventory and a rate plan to get started.",
  "Precio por noche en {currency}": "Price per night in {currency}",
  "Reglas y ajustes de {name}": "Rules and settings for {name}",
  "Base {amount}": "Base {amount}",
  "Precio de {name} el {date}": "Price for {name} on {date}",
  "Cambiar precio del {date}": "Change price for {date}",
  "mínimo {n} noches": "minimum {n} nights",
  "Enter guarda · Esc cancela · Tab pasa al día siguiente. Los días pasados no se editan.":
    "Enter saves · Esc cancels · Tab moves to the next day. Past days can't be edited.",
  "Nuevo plan de tarifas": "New rate plan",
  "Tarifa no reembolsable": "Non-refundable rate",
  "mín. {n} noches": "min. {n} nights",
  "La fecha final debe ser igual o posterior a la inicial.":
    "The end date must be on or after the start date.",
  "El máximo debe ser mayor o igual al mínimo.":
    "The maximum must be greater than or equal to the minimum.",
  "Reglas por fechas": "Rules by date",
  "Ajustes del alojamiento": "Accommodation settings",
  "RESTRICCIONES PRÓXIMAS": "UPCOMING RESTRICTIONS",
  Desde: "From",
  "Hasta (incluido)": "To (inclusive)",
  "Precio por noche ({currency})": "Price per night ({currency})",
  "Mantener precios actuales": "Keep current prices",
  "Déjalo vacío para cambiar solo las reglas.":
    "Leave it empty to change only the rules.",
  Noches: "Nights",
  "Mínimo de noches": "Minimum nights",
  "Máximo de noches": "Maximum nights",
  "Cerrar venta": "Close sales",
  "Cerrar llegadas": "Close to arrival",
  "Cerrar salidas": "Close to departure",
  "Aplicar a {count} noches": "Apply to {count} nights",
  "Tarifa base por noche": "Base rate per night",
  "Se usa en las noches sin precio propio.":
    "Used on nights without their own price.",
  "Huéspedes máximos": "Maximum guests",
  "Disponible para la venta": "Available for sale",
  "Tu rol permite cambiar tarifas, no los ajustes del alojamiento.":
    "Your role can change rates, not accommodation settings.",
  "Guardando…": "Saving…",
  "Plan de tarifas": "Rate plan",

  // Inventory
  "CADA ESPACIO TIENE SU LUGAR": "EVERY SPACE HAS ITS PLACE",
  "Gestiona la propiedad, sus alojamientos, unidades y bloqueos. Pulsa cualquier tarjeta para ver y cambiar sus opciones.":
    "Manage the property, its accommodations, units and blocks. Tap any card to see and change its options.",
  "Bloquear unidad": "Block unit",
  "Nuevo tipo": "New type",
  Propiedad: "Property",
  Unidades: "Units",
  "Tipos de inventario": "Inventory types",
  Bloqueos: "Blocks",
  "Opciones de {name}": "Options for {name}",
  "Venta por cama": "Sold by bed",
  "Venta por unidad": "Sold by unit",
  "hasta {count} personas": "up to {count} people",
  "noche base": "base night",
  "Sin amenities configuradas": "No amenities set",
  "Fuera de venta": "Not for sale",
  "salida exclusiva": "checkout exclusive",
  "Liberar bloqueo": "Release block",
  "Todos los espacios, disponibles para operar": "Every space, ready to operate",
  "No hay bloqueos activos.": "No active blocks.",
  "La limpieza no cambia la disponibilidad de venta.":
    "Housekeeping status doesn't change sales availability.",
  "Agregar unidad": "Add unit",
  "Dentro de": "Inside",
  "Fuera de servicio": "Out of service",
  "Tiene bloqueos programados": "Has scheduled blocks",
  "Sin bloqueos programados": "No scheduled blocks",
  "Crea tus primeros espacios": "Create your first spaces",
  "Añade un tipo de inventario con sus unidades.":
    "Add an inventory type with its units.",
  "Nuevo tipo de inventario": "New inventory type",
  "Nombre del tipo": "Type name",
  "Se vende por": "Sold by",
  "Unidad completa": "Entire unit",
  "Capacidad máxima": "Maximum capacity",
  "Tarifa base": "Base rate",
  "Precio por noche, por ejemplo 2400.00": "Price per night, for example 2400.00",
  "Unidades a crear": "Units to create",
  "Habitación contenedora (camas)": "Parent room (beds)",
  "Sin habitación contenedora": "No parent room",
  Amenities: "Amenities",
  "Separadas por coma": "Comma separated",
  "Nombre de la unidad": "Unit name",
  "Habitación contenedora": "Parent room",
  Ninguna: "None",
  Motivo: "Reason",
  "Hasta (exclusivo)": "To (exclusive)",
  "Usa «Nueva propiedad» para registrarla.": "Use «New property» to register it.",
  "Tipos de alojamiento": "Accommodation types",
  "Llegada · salida": "Check-in · check-out",
  "Datos de la propiedad": "Property details",
  "Lo mismo que registras al crear una propiedad. Los cambios se guardan en la base de datos de CALA.":
    "The same details you register when creating a property. Changes are saved to CALA's database.",
  "Guardar propiedad": "Save property",
  "Tipo de alojamiento": "Accommodation type",
  "Llegada desde": "Check-in from",
  "Salida hasta": "Check-out until",
  "Impuestos (%)": "Taxes (%)",
  "Política de cancelación y casa": "Cancellation and house policy",
  LIMPIEZA: "HOUSEKEEPING",
  "PRÓXIMAS ESTANCIAS": "UPCOMING STAYS",
  "Sin estancias próximas.": "No upcoming stays.",
  "Guardar unidad": "Save unit",
  Recámaras: "Bedrooms",
  Camas: "Beds",
  Baños: "Bathrooms",
  "En servicio (se puede vender y asignar)": "In service (can be sold and assigned)",
  "Tu rol permite consultar esta unidad.": "Your role can view this unit.",
  "Bloquear fechas": "Block dates",
  Liberar: "Release",
  "Guardar alojamiento": "Save accommodation",
  "Se usa en las noches sin precio propio. Ajusta precios por día en Tarifas.":
    "Used on nights without their own price. Adjust daily prices in Rates.",
  "Tu rol permite consultar este alojamiento.": "Your role can view this accommodation.",
  "Abrir el calendario de tarifas": "Open the rates calendar",
  "Configura tu primera propiedad": "Set up your first property",
  Dirección: "Address",
  "Por limpiar": "Dirty",
  Limpia: "Clean",
  Inspeccionada: "Inspected",

  // Dashboard
  "TU ESPACIO": "YOUR WORKSPACE",
  "Hola, {name}.": "Hi, {name}.",
  "Así se siente hoy {name}.": "This is how {name} feels today.",
  "Demos la bienvenida a tu primera propiedad.": "Let's welcome your first property.",
  "Personalizar Inicio": "Customize Home",
  "Tu próxima historia empieza aquí": "Your next story starts here",
  "Configura una propiedad para comenzar.": "Set up a property to get started.",
  "Crear mi primera propiedad": "Create my first property",
  "Llegadas de hoy": "Today's arrivals",
  "Nuevas historias por recibir": "New stories to welcome",
  "Salidas de hoy": "Today's departures",
  "Hasta la próxima estancia": "Until the next stay",
  "{count} unidades en tu propiedad": "{count} units in your property",
  "Saldo por cobrar": "Balance due",
  "Unidades por limpiar": "Units to clean",
  "Saldo de todos los folios": "Balance across all folios",
  "Preparar antes de la llegada": "Prepare before arrival",
  "EL RITMO DEL DÍA": "THE RHYTHM OF THE DAY",
  "Hoy en tu propiedad": "Today at your property",
  "Ver calendario": "View calendar",
  "Operación de hoy": "Today's operations",
  Llegadas: "Arrivals",
  Salidas: "Departures",
  "La operación está en tus manos": "Operations are in your hands",
  "Consulta tus tareas de limpieza y mantenimiento.":
    "Check your housekeeping and maintenance tasks.",
  "Ver housekeeping": "View housekeeping",
  "Disponibilidad actualizada con cada operación":
    "Availability updated with every action",
  "Necesita tu atención": "Needs your attention",
  "unidad por preparar": "unit to prepare",
  "unidades por preparar": "units to prepare",
  "Todo listo para una buena llegada.": "All set for a great arrival.",
  "Prioridad alta": "High priority",
  "En seguimiento": "Following up",
  "No hay pendientes urgentes.": "Nothing urgent pending.",
  "ESPACIO PARA LO IMPORTANTE": "ROOM FOR WHAT MATTERS",
  "Una buena estancia": "A great stay",
  "empieza antes de llegar.": "begins before arrival.",
  "Consulta los detalles, prepara las habitaciones y recibe con calma.":
    "Check the details, prepare the rooms and welcome guests calmly.",
  "Revisar mi propiedad": "Review my property",
  "TU PORTAFOLIO": "YOUR PORTFOLIO",
  "Hospitalidad en cada lugar": "Hospitality everywhere",
  Actual: "Current",
  "{count} unidades": "{count} units",
  "Actividad reciente": "Recent activity",
  "Los cambios de esta propiedad aparecerán aquí.":
    "Changes to this property will appear here.",

  // Finance
  "CADA MOVIMIENTO, CLARO": "EVERY MOVEMENT, CLEAR",
  "Folios, cargos y saldos. Trazabilidad desde el primer pago hasta el último ajuste.":
    "Folios, charges and balances. Traceable from the first payment to the last adjustment.",
  "Sin folios todavía": "No folios yet",
  "Los folios se crean al registrar una reserva.":
    "Folios are created when a reservation is recorded.",
  FOLIO: "FOLIO",
  Cargos: "Charges",
  "Pagado neto": "Net paid",
  Saldo: "Balance",
  "Agregar cargo": "Add charge",
  Concepto: "Item",
  Fecha: "Date",
  Pagos: "Payments",
  "Pago ·": "Payment ·",
  "Este folio aún no tiene pagos.": "This folio has no payments yet.",
  "Importe en la moneda de la propiedad; hasta dos decimales.":
    "Amount in the property's currency; up to two decimals.",

  // Guests
  "CONOCE A QUIENES VUELVEN": "GET TO KNOW YOUR RETURNING GUESTS",
  Huéspedes: "Guests",
  "Contactos e historial de estancias de las propiedades a las que tienes acceso.":
    "Contacts and stay history for the properties you can access.",
  "Buscar huésped": "Search guest",
  "Nombre, correo o teléfono": "Name, email or phone",
  "Huéspedes recurrentes": "Returning guests",
  "Contactos de huéspedes": "Guest contacts",
  Contacto: "Contact",
  Estancias: "Stays",
  Perfil: "Profile",
  "Sin correo": "No email",
  "Ver perfil": "View profile",
  "Sin huéspedes para mostrar": "No guests to show",
  "Los contactos se guardan cuando registras una reserva. También puedes crear uno manualmente.":
    "Contacts are saved when you record a reservation. You can also create one manually.",
  Correo: "Email",
  Teléfono: "Phone",
  "Sin teléfono": "No phone",
  Empresa: "Company",
  "Sin empresa": "No company",
  "Sin dirección": "No address",
  "Sin especificar": "Not specified",
  "Editar datos": "Edit details",
  "Historial de estancias": "Stay history",
  "Nuevo huésped": "New guest",
  "{count} contactos": "{count} contacts",
};
