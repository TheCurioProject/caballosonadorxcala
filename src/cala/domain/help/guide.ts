/**
 * CALA function guide shown by "Asistente CALA → Guía de funciones".
 * One topic per screen or shared tool; short, task-oriented, bilingual.
 * `path` matches the /admin/<path> section so the guide opens on the
 * screen the person is using.
 */
import type { AssetId } from "@/cala/assets/registry";

type Copy = { title: string; summary: string; steps: string[]; tip?: string };
export interface GuideTopic {
  path: string;
  group: string;
  icon: AssetId;
  es: Copy;
  en: Copy;
}

export const guideGroups: Record<string, { es: string; en: string }> = {
  basics: { es: "Lo básico", en: "Basics" },
  operation: { es: "Operación", en: "Operations" },
  management: { es: "Gestión", en: "Management" },
  tools: { es: "Herramientas", en: "Tools" },
  settings: { es: "Configuración", en: "Settings" },
  web: { es: "Casa Caballo Soñador (web)", en: "Casa Caballo Soñador (website)" },
};

export const guide: GuideTopic[] = [
  // Basics
  {
    path: "navegacion",
    group: "basics",
    icon: "menu",
    es: {
      title: "Moverte por CALA",
      summary: "El menú lateral (o la barra inferior en el móvil) agrupa todo en Operación, Gestión, Herramientas y Configuración.",
      steps: [
        "Elige la propiedad activa arriba del menú; todo lo que ves y guardas es de esa propiedad.",
        "En el móvil, «Más» abre el resto de secciones y un buscador de herramientas.",
        "Cada sección se abre desde arriba; los cambios se guardan en la base de datos al confirmar.",
      ],
      tip: "El aviso «Cambios guardados» al pie confirma que el servidor recibió tu cambio.",
    },
    en: {
      title: "Getting around CALA",
      summary: "The side menu (or bottom bar on mobile) groups everything into Operations, Management, Tools and Settings.",
      steps: [
        "Pick the active property at the top of the menu; everything you see and save belongs to it.",
        "On mobile, «More» opens the remaining sections and a tool search.",
        "Every section opens at the top; changes are saved to the database when you confirm.",
      ],
      tip: "The «Changes saved» note in the footer confirms the server received your change.",
    },
  },
  {
    path: "buscar",
    group: "basics",
    icon: "search",
    es: {
      title: "Búsqueda rápida",
      summary: "Salta a cualquier sección o reserva sin navegar.",
      steps: [
        "Pulsa «Buscar en CALA» o ⌘K / Ctrl+K.",
        "Escribe el nombre de una sección o un código de confirmación (EST…).",
        "Elige el resultado para abrirlo.",
      ],
    },
    en: {
      title: "Quick search",
      summary: "Jump to any section or reservation without browsing.",
      steps: [
        "Press «Search CALA» or ⌘K / Ctrl+K.",
        "Type a section name or a confirmation code (EST…).",
        "Choose the result to open it.",
      ],
    },
  },
  {
    path: "idioma",
    group: "basics",
    icon: "settings",
    es: {
      title: "Idioma, texto y apariencia",
      summary: "Cambia entre español e inglés con el botón ES/EN de la barra superior (en el móvil, el botón EN/ES de la cabecera).",
      steps: [
        "El idioma cambia toda la interfaz al momento y se recuerda en este dispositivo.",
        "En Configuración eliges tema (Shell, Ink, Sand, Pacific), densidad y tamaño de texto: Normal, Mediano o Grande.",
        "El tamaño de texto se adapta a cada dispositivo sin romper calendarios ni tarjetas.",
      ],
    },
    en: {
      title: "Language, text and appearance",
      summary: "Switch between Spanish and English with the ES/EN button in the top bar (on mobile, the EN/ES button in the header).",
      steps: [
        "The whole interface switches instantly and is remembered on this device.",
        "In Settings you choose theme (Shell, Ink, Sand, Pacific), density and text size: Normal, Medium or Large.",
        "Text size adapts to each device without breaking calendars or cards.",
      ],
    },
  },
  {
    path: "app",
    group: "basics",
    icon: "download",
    es: {
      title: "Instalar CALA como app",
      summary: "Úsala como aplicación en móvil, tablet o computadora.",
      steps: [
        "iPhone/iPad: en Safari, Compartir → «Añadir a pantalla de inicio».",
        "Android: menú de Chrome → «Instalar aplicación».",
        "Computadora: icono de instalación de Chrome/Edge o «Añadir al Dock» en Safari.",
      ],
      tip: "Sin conexión puedes consultar, pero los cambios se confirman al reconectar.",
    },
    en: {
      title: "Install CALA as an app",
      summary: "Use it as an app on phone, tablet or computer.",
      steps: [
        "iPhone/iPad: in Safari, Share → «Add to Home Screen».",
        "Android: Chrome menu → «Install app».",
        "Computer: Chrome/Edge install icon or «Add to Dock» in Safari.",
      ],
      tip: "Offline you can browse, but changes are confirmed once you reconnect.",
    },
  },
  // Operations
  {
    path: "inicio",
    group: "operation",
    icon: "home",
    es: {
      title: "Inicio",
      summary: "El resumen del día: llegadas, salidas, huéspedes en casa, saldo por cobrar y lo que necesita tu atención.",
      steps: [
        "Revisa las pestañas Llegadas, Salidas y En casa para preparar el día.",
        "«Necesita tu atención» lista unidades por limpiar, tareas y canales con incidencias.",
        "«Personalizar Inicio» muestra u oculta indicadores y bloques.",
      ],
    },
    en: {
      title: "Home",
      summary: "Today at a glance: arrivals, departures, in-house guests, balance due and what needs attention.",
      steps: [
        "Use the Arrivals, Departures and In house tabs to plan the day.",
        "«Needs your attention» lists units to clean, tasks and channels with issues.",
        "«Customize Home» shows or hides indicators and blocks.",
      ],
    },
  },
  {
    path: "calendario",
    group: "operation",
    icon: "calendar",
    es: {
      title: "Calendario",
      summary: "Todas las unidades por fecha (Múltiple) o una unidad estilo Airbnb (Individual).",
      steps: [
        "Arrastra sobre días libres para seleccionar fechas y crear una reserva o un bloqueo.",
        "Arrastra una reserva a otra fecha o habitación para moverla; CALA revisa disponibilidad y precio antes de confirmar.",
        "En táctil: desliza para recorrer el mes y mantén pulsado para seleccionar o mover.",
        "En Individual puedes cambiar precio, estancia mínima o cerrar noches de la selección.",
        "«Personalizar calendario» elige vista inicial, días visibles y qué datos ver en cada estancia.",
      ],
      tip: "Reservar la casa completa bloquea sus habitaciones y viceversa.",
    },
    en: {
      title: "Calendar",
      summary: "Every unit by date (Multi) or a single unit, Airbnb style (Single).",
      steps: [
        "Drag across free days to select dates and create a reservation or a block.",
        "Drag a reservation to another date or room to move it; CALA checks availability and price before confirming.",
        "On touch: swipe to browse the month and press and hold to select or move.",
        "In Single view you can change price, minimum stay or close nights for the selection.",
        "«Customize calendar» sets the default view, visible days and what each stay shows.",
      ],
      tip: "Booking the entire house blocks its rooms and vice versa.",
    },
  },
  {
    path: "reservas",
    group: "operation",
    icon: "reservation",
    es: {
      title: "Reservas",
      summary: "La lista de estancias con búsqueda y filtro por estado.",
      steps: [
        "«Nueva reserva» te guía: huésped, fechas y unidad, tarifa y revisión.",
        "Pulsa cualquier parte de una fila para abrir el detalle.",
        "En el detalle: cambia estado (check-in, check-out, cancelar), edita datos del huésped, genera la invoice y revisa el folio.",
      ],
      tip: "Cancelar libera el inventario y queda registrado en el historial.",
    },
    en: {
      title: "Reservations",
      summary: "The list of stays with search and status filter.",
      steps: [
        "«New reservation» guides you: guest, dates and unit, rate and review.",
        "Click anywhere on a row to open its details.",
        "In details: change status (check-in, check-out, cancel), edit guest data, generate the invoice and review the folio.",
      ],
      tip: "Cancelling frees the inventory and is recorded in the history.",
    },
  },
  {
    path: "inbox",
    group: "operation",
    icon: "inbox",
    es: {
      title: "Inbox (mensajes)",
      summary: "Una bandeja por estancia para responder a huéspedes de todos los canales.",
      steps: [
        "Filtra por Sin leer, Mías, Borradores o canal y abre una conversación.",
        "Escribe un mensaje o una nota interna que solo ve el equipo; puedes usar plantillas y programar el envío.",
        "Asígnate la conversación o archívala cuando esté resuelta.",
        "«Conectar canal» abre el asistente para vincular Airbnb, Booking.com, Expedia y otros.",
      ],
      tip: "Sin proveedor conectado, los mensajes quedan como «Pendiente de entrega».",
    },
    en: {
      title: "Inbox (messages)",
      summary: "One thread per stay to reply to guests from every channel.",
      steps: [
        "Filter by Unread, Mine, Drafts or channel and open a conversation.",
        "Write a message or an internal note only the team sees; you can use templates and schedule sending.",
        "Assign the conversation to yourself or archive it when solved.",
        "«Connect channel» opens the assistant to link Airbnb, Booking.com, Expedia and more.",
      ],
      tip: "Without a connected provider, messages stay «Pending delivery».",
    },
  },
  {
    path: "huespedes",
    group: "operation",
    icon: "guests",
    es: {
      title: "Huéspedes",
      summary: "Contactos e historial de estancias.",
      steps: [
        "Busca por nombre, correo o teléfono; filtra los recurrentes.",
        "Abre un perfil para ver sus estancias y editar sus datos.",
        "«Nuevo huésped» crea un contacto sin reserva.",
      ],
    },
    en: {
      title: "Guests",
      summary: "Contacts and stay history.",
      steps: [
        "Search by name, email or phone; filter returning guests.",
        "Open a profile to see their stays and edit their details.",
        "«New guest» creates a contact without a reservation.",
      ],
    },
  },
  {
    path: "inventario",
    group: "operation",
    icon: "inventory",
    es: {
      title: "Inventario (gestión de la propiedad)",
      summary: "Todo lo que registras en «Nueva propiedad», editable: datos de la propiedad, tipos de alojamiento, unidades y bloqueos.",
      steps: [
        "Pestaña Propiedad: nombre, tipo, dirección, horarios de llegada y salida, impuestos y política.",
        "Pulsa una unidad para cambiar nombre, tipo, recámaras, camas, baños, si está en servicio, su limpieza y sus bloqueos.",
        "Pulsa un tipo para cambiar tarifa base, capacidad o sacarlo de la venta.",
        "«Bloquear unidad» cierra fechas por mantenimiento u otro motivo.",
      ],
    },
    en: {
      title: "Inventory (property management)",
      summary: "Everything you register in «New property», editable: property details, accommodation types, units and blocks.",
      steps: [
        "Property tab: name, type, address, check-in/out times, taxes and policy.",
        "Tap a unit to change its name, type, bedrooms, beds, bathrooms, whether it's in service, housekeeping and blocks.",
        "Tap a type to change its base rate, capacity or take it off sale.",
        "«Block unit» closes dates for maintenance or another reason.",
      ],
    },
  },
  // Management
  {
    path: "tarifas",
    group: "management",
    icon: "rates",
    es: {
      title: "Tarifas y restricciones",
      summary: "Un calendario mensual con el precio de cada noche por alojamiento, como en Smoobu.",
      steps: [
        "Pulsa un precio para cambiar esa noche: Enter guarda, Esc cancela, Tab pasa al día siguiente.",
        "Pulsa el nombre de un alojamiento para aplicar reglas a un rango: precio, estancia mínima/máxima, cerrar venta, llegadas o salidas.",
        "En «Ajustes del alojamiento» cambias tarifa base y capacidad.",
        "Las marcas en cada día indican cerrado, sin llegadas, sin salidas o estancia mínima.",
      ],
      tip: "Estos precios son los mismos que usa la web de reservas.",
    },
    en: {
      title: "Rates and restrictions",
      summary: "A monthly calendar with each night's price per accommodation, like Smoobu.",
      steps: [
        "Tap a price to change that night: Enter saves, Esc cancels, Tab moves to the next day.",
        "Tap an accommodation's name to apply rules to a range: price, min/max stay, close sales, arrivals or departures.",
        "«Accommodation settings» changes base rate and capacity.",
        "Marks on each day show closed, no arrivals, no departures or minimum stay.",
      ],
      tip: "These are the same prices the booking website uses.",
    },
  },
  {
    path: "canales",
    group: "management",
    icon: "channels",
    es: {
      title: "Canales y calendarios externos",
      summary: "Conexiones con OTAs y calendarios iCal por unidad.",
      steps: [
        "Comparte disponibilidad con un enlace iCal privado o un calendario público para incrustar.",
        "«Importar iCal» trae bloqueos de otros calendarios (Airbnb, Booking…).",
        "Rotar o revocar un enlace lo invalida al instante.",
      ],
    },
    en: {
      title: "Channels and external calendars",
      summary: "OTA connections and per-unit iCal calendars.",
      steps: [
        "Share availability with a private iCal link or an embeddable public calendar.",
        "«Import iCal» brings blocks from other calendars (Airbnb, Booking…).",
        "Rotating or revoking a link invalidates it immediately.",
      ],
    },
  },
  {
    path: "limpieza",
    group: "management",
    icon: "housekeeping",
    es: {
      title: "Housekeeping",
      summary: "Estado de limpieza de cada unidad y tareas del equipo.",
      steps: [
        "Cambia el estado de cada unidad: Limpia, Por limpiar o Inspeccionada.",
        "«Nueva tarea» asigna un trabajo con prioridad y responsable.",
      ],
      tip: "La limpieza no cambia la disponibilidad de venta.",
    },
    en: {
      title: "Housekeeping",
      summary: "Each unit's cleaning status and team tasks.",
      steps: [
        "Change each unit's status: Clean, Dirty or Inspected.",
        "«New task» assigns a job with priority and assignee.",
      ],
      tip: "Housekeeping status doesn't change sales availability.",
    },
  },
  {
    path: "mantenimiento",
    group: "management",
    icon: "maintenance",
    es: {
      title: "Mantenimiento",
      summary: "Tareas de reparación y seguimiento por unidad o área común.",
      steps: [
        "Crea una tarea, asígnala y marca su avance: pendiente, en proceso, completada.",
        "Filtra por estado para ver lo pendiente.",
      ],
    },
    en: {
      title: "Maintenance",
      summary: "Repair and follow-up tasks per unit or common area.",
      steps: [
        "Create a task, assign it and track it: pending, in progress, completed.",
        "Filter by status to see what's pending.",
      ],
    },
  },
  {
    path: "finanzas",
    group: "management",
    icon: "finance",
    es: {
      title: "Finanzas",
      summary: "Folios de cada estancia con cargos, pagos y saldo.",
      steps: [
        "Abre un folio para ver el detalle.",
        "«Agregar cargo» suma extras (comida, tours, daños…).",
        "Registra pagos para que el saldo quede al día.",
      ],
    },
    en: {
      title: "Finance",
      summary: "Each stay's folio with charges, payments and balance.",
      steps: [
        "Open a folio to see its details.",
        "«Add charge» adds extras (food, tours, damages…).",
        "Record payments so the balance stays up to date.",
      ],
    },
  },
  // Tools
  {
    path: "plantillas",
    group: "tools",
    icon: "message",
    es: {
      title: "Plantillas de mensajes",
      summary: "Textos reutilizables por idioma con variables del huésped y la reserva.",
      steps: [
        "«Nueva plantilla»: escribe el texto e inserta variables como nombre o fechas.",
        "Elige un evento de referencia (llegada, salida…) y los días antes o después.",
        "Previsualízala con una reserva real antes de guardar.",
      ],
    },
    en: {
      title: "Message templates",
      summary: "Reusable texts per language with guest and reservation variables.",
      steps: [
        "«New template»: write the text and insert variables like name or dates.",
        "Pick a reference event (arrival, departure…) and days before or after.",
        "Preview it with a real reservation before saving.",
      ],
    },
  },
  {
    path: "mercado",
    group: "tools",
    icon: "reports",
    es: {
      title: "Estudio de mercado y agente",
      summary: "El agente investiga tu nicho y competencia, estudia tu historial y te dice qué hacer para vender más.",
      steps: [
        "Pulsa «Analizar ahora»: verás qué revisa y luego recomendaciones ordenadas por urgencia.",
        "Cada recomendación explica por qué, qué hacer y te lleva a la sección para aplicarla.",
        "Importa precios y ocupación de 3–5 competidores (CSV) para comparaciones más precisas.",
      ],
      tip: "El agente nunca cambia precios por sí solo.",
    },
    en: {
      title: "Market study and agent",
      summary: "The agent researches your niche and competition, studies your history and tells you how to sell more.",
      steps: [
        "Press «Analyze now»: you'll see what it checks, then recommendations sorted by urgency.",
        "Each recommendation explains why, what to do and links to the section to apply it.",
        "Import prices and occupancy for 3–5 competitors (CSV) for sharper comparisons.",
      ],
      tip: "The agent never changes prices on its own.",
    },
  },
  {
    path: "automatizaciones",
    group: "tools",
    icon: "automation",
    es: {
      title: "Automatizaciones",
      summary: "Reglas que reaccionan solas a eventos de reservas.",
      steps: [
        "«Nueva regla»: elige cuándo (reserva creada, cancelada, check-out) y qué hacer (crear tarea de limpieza, avisar al equipo).",
        "Pausa o activa cada regla cuando quieras.",
      ],
    },
    en: {
      title: "Automations",
      summary: "Rules that react to reservation events by themselves.",
      steps: [
        "«New rule»: choose when (reservation created, cancelled, check-out) and what to do (create a cleaning task, notify the team).",
        "Pause or activate each rule anytime.",
      ],
    },
  },
  {
    path: "reportes",
    group: "tools",
    icon: "reports",
    es: {
      title: "Reportes",
      summary: "Ocupación, ingresos, ADR, RevPAR, anticipación, duración y cancelaciones por período.",
      steps: [
        "Elige el rango y filtra por tipo, canal o incluye pendientes.",
        "Cambia entre Gráficas y Tablas; compara con el período anterior.",
        "Descarga el CSV para tu contabilidad.",
      ],
    },
    en: {
      title: "Reports",
      summary: "Occupancy, revenue, ADR, RevPAR, lead time, length of stay and cancellations by period.",
      steps: [
        "Pick the range and filter by type or channel, or include pending.",
        "Switch between Charts and Tables; compare with the previous period.",
        "Download the CSV for your accounting.",
      ],
    },
  },
  {
    path: "actividad",
    group: "tools",
    icon: "activity",
    es: {
      title: "Activity Center",
      summary: "Procesos en segundo plano (importaciones, sincronizaciones, reportes) y la auditoría de cambios del equipo.",
      steps: [
        "La campana de la barra superior avisa cuando hay procesos activos.",
        "Abre un proceso para ver su progreso o reintentarlo.",
      ],
    },
    en: {
      title: "Activity Center",
      summary: "Background processes (imports, syncs, reports) and the team's change audit.",
      steps: [
        "The bell in the top bar shows when processes are running.",
        "Open a process to see its progress or retry it.",
      ],
    },
  },
  // Settings
  {
    path: "equipo",
    group: "settings",
    icon: "team",
    es: {
      title: "Equipo y permisos",
      summary: "Propietario, administrador, gerente y recepción pueden añadir y gestionar al equipo.",
      steps: [
        "«Añadir miembro»: nombre, correo, rol, propiedades y, si quieres, una contraseña temporal para que entre al momento.",
        "Pulsa una persona para cambiar su rol, suspenderla o retirarla del equipo.",
        "Cada quien gestiona solo roles por debajo del suyo; el propietario puede nombrar administradores.",
      ],
    },
    en: {
      title: "Team and permissions",
      summary: "Owner, administrator, manager and front desk can add and manage the team.",
      steps: [
        "«Add member»: name, email, role, properties and, optionally, a temporary password so they can sign in right away.",
        "Tap a person to change their role, suspend them or remove them.",
        "Everyone manages only roles below their own; the owner can appoint administrators.",
      ],
    },
  },
  {
    path: "ajustes",
    group: "settings",
    icon: "settings",
    es: {
      title: "Configuración",
      summary: "Apariencia, idioma, organización y datos básicos de la propiedad.",
      steps: [
        "Elige tema, densidad y tamaño de texto.",
        "Cambia el idioma de la interfaz o la organización activa.",
        "Edita nombre, ciudad, sobreventa y política de la propiedad.",
      ],
    },
    en: {
      title: "Settings",
      summary: "Appearance, language, organization and basic property details.",
      steps: [
        "Choose theme, density and text size.",
        "Change the interface language or the active organization.",
        "Edit the property's name, city, overbooking and policy.",
      ],
    },
  },
  {
    path: "onboarding",
    group: "settings",
    icon: "plus",
    es: {
      title: "Nueva propiedad",
      summary: "Un asistente paso a paso para registrar otra propiedad en CALA.",
      steps: [
        "Concepto, ubicación, moneda y zona horaria.",
        "Cómo vendes (por habitación o cama), unidades, servicios, horarios, tarifa y política.",
        "Puedes guardar y salir; tu avance se conserva.",
      ],
      tip: "Las propiedades nuevas solo viven en CALA; la web pública muestra únicamente Casa Caballo Soñador.",
    },
    en: {
      title: "New property",
      summary: "A step-by-step assistant to register another property in CALA.",
      steps: [
        "Concept, location, currency and time zone.",
        "How you sell (by room or bed), units, services, schedules, rate and policy.",
        "You can save and exit; your progress is kept.",
      ],
      tip: "New properties live only in CALA; the public website only shows Casa Caballo Soñador.",
    },
  },
  // Website modules
  {
    path: "content",
    group: "web",
    icon: "inventory",
    es: {
      title: "Contenido e imágenes",
      summary: "Las fotos de la web pública, con historial para restaurar versiones.",
      steps: ["Sube o reemplaza una imagen.", "Usa «Restaurar» para volver a una versión anterior."],
    },
    en: {
      title: "Content & images",
      summary: "The public website's photos, with history to restore versions.",
      steps: ["Upload or replace an image.", "Use «Restore» to return to a previous version."],
    },
  },
  {
    path: "alojamientos",
    group: "web",
    icon: "property",
    es: {
      title: "Alojamientos y página web",
      summary: "Lo que la web muestra de la casa completa y cada habitación.",
      steps: [
        "Edita nombre, descripción, camas, fotos, amenidades y política en ambos idiomas.",
        "Define estancia mínima/máxima, anticipación, noches de preparación y hasta cuándo se puede reservar.",
        "«Cierres de venta de la casa completa» cierra la casa en la web sin bloquear las habitaciones.",
      ],
    },
    en: {
      title: "Accommodations & website",
      summary: "What the website shows for the entire house and each room.",
      steps: [
        "Edit name, description, beds, photos, amenities and policy in both languages.",
        "Set min/max stay, lead time, preparation nights and how far ahead guests can book.",
        "«Entire-house sales closures» closes the house on the website without blocking rooms.",
      ],
    },
  },
  {
    path: "experiencias",
    group: "web",
    icon: "inventory",
    es: {
      title: "Experiencias",
      summary: "Tours y destinos que se venden en la web, con sus ajustes globales.",
      steps: ["Crea o edita tours, precios y destinos.", "Ajusta mínimos y máximos de personas."],
    },
    en: {
      title: "Experiences",
      summary: "Tours and destinations sold on the website, with global settings.",
      steps: ["Create or edit tours, prices and destinations.", "Set minimum and maximum group sizes."],
    },
  },
  {
    path: "atv-tours",
    group: "web",
    icon: "mapping",
    es: {
      title: "ATV Tours",
      summary: "Los tours de la página pública de tours: textos, fotos, precio y orden.",
      steps: ["Crea o edita un tour con sus fotos y textos en español e inglés.", "Ordénalos, ocúltalos o elimínalos; la web se actualiza al guardar."],
    },
    en: {
      title: "ATV Tours",
      summary: "The tours on the public tours page: texts, photos, price and order.",
      steps: ["Create or edit a tour with its photos and texts in Spanish and English.", "Reorder, hide or delete them; the website updates when you save."],
    },
  },
  {
    path: "cupones",
    group: "web",
    icon: "receipt",
    es: {
      title: "Cupones",
      summary: "Códigos de descuento que los huéspedes escriben al reservar en la web y que Stripe aplica al pago.",
      steps: ["Crea un cupón con porcentaje o monto fijo, vigencia y límite de usos.", "Compártelo: el huésped lo escribe en el resumen de su reserva."],
    },
    en: {
      title: "Coupons",
      summary: "Discount codes guests enter when booking on the website and Stripe applies to the payment.",
      steps: ["Create a coupon with a percentage or fixed amount, validity and usage limit.", "Share it: the guest enters it in the booking summary."],
    },
  },
  {
    path: "writers-group",
    group: "web",
    icon: "message",
    es: {
      title: "Talleres de escritura",
      summary: "Talleres publicados en la web con fechas e instructor.",
      steps: ["Crea un taller y completa sus detalles.", "Publícalo o retíralo cuando quieras."],
    },
    en: {
      title: "Writing workshops",
      summary: "Workshops published on the website with dates and instructor.",
      steps: ["Create a workshop and fill in its details.", "Publish or withdraw it anytime."],
    },
  },
  {
    path: "during-your-stay",
    group: "web",
    icon: "housekeeping",
    es: {
      title: "Durante la estancia",
      summary: "La información práctica que ven los huéspedes en la web durante su visita.",
      steps: ["Edita las secciones y guarda para publicarlas."],
    },
    en: {
      title: "During your stay",
      summary: "Practical information guests see on the website during their visit.",
      steps: ["Edit the sections and save to publish them."],
    },
  },
  {
    path: "servicios-comida",
    group: "web",
    icon: "finance",
    es: {
      title: "Comida y servicios",
      summary: "Servicios de cocina y platillos que se ofrecen al reservar.",
      steps: ["Crea servicios y platillos con precio.", "Activa o desactiva lo que se ofrece."],
    },
    en: {
      title: "Food & services",
      summary: "Cooking services and dishes offered when booking.",
      steps: ["Create services and dishes with prices.", "Turn offerings on or off."],
    },
  },
  {
    path: "tours-bookings",
    group: "web",
    icon: "reservation",
    es: {
      title: "Reservas de servicios",
      summary: "Tours y servicios reservados desde la web, con pagos pendientes.",
      steps: ["Revisa próximos tours y pagos pendientes.", "Elimina o ajusta una reserva de servicio."],
    },
    en: {
      title: "Service bookings",
      summary: "Tours and services booked on the website, with pending payments.",
      steps: ["Review upcoming tours and pending payments.", "Delete or adjust a service booking."],
    },
  },
  {
    path: "stripe",
    group: "web",
    icon: "finance",
    es: {
      title: "Pagos de la web",
      summary: "Saldo de Stripe, pagos recientes y cupones activos de la pasarela de pago.",
      steps: ["Consulta pagos y saldo.", "Revisa o desactiva cupones."],
    },
    en: {
      title: "Website payments",
      summary: "Stripe balance, recent payments and active coupons for the payment gateway.",
      steps: ["Check payments and balance.", "Review or disable coupons."],
    },
  },
  {
    path: "settings",
    group: "web",
    icon: "settings",
    es: {
      title: "Ajustes de la web",
      summary: "Reglas de la casa, disponibilidad de servicios, cupones de descuento y credenciales.",
      steps: [
        "Edita las reglas base de la casa.",
        "Define cuándo se ofrecen comida y tours.",
        "Crea cupones de descuento de Stripe.",
      ],
    },
    en: {
      title: "Website settings",
      summary: "House rules, service availability, discount coupons and credentials.",
      steps: [
        "Edit the base house rules.",
        "Set when food and tours are offered.",
        "Create Stripe discount coupons.",
      ],
    },
  },
  {
    path: "integracion",
    group: "web",
    icon: "activity",
    es: {
      title: "Revisión de pagos",
      summary: "Pagos web que llegaron con un conflicto de disponibilidad.",
      steps: [
        "Revisa cada caso; la reserva queda como borrador en CALA.",
        "Acuerda con el huésped un cambio de fechas o gestiona el reembolso en Stripe.",
      ],
    },
    en: {
      title: "Payment review",
      summary: "Website payments that arrived with an availability conflict.",
      steps: [
        "Review each case; the reservation stays as a draft in CALA.",
        "Agree new dates with the guest or process the refund in Stripe.",
      ],
    },
  },
];
