"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { browserPreferences } from "@/cala/lib/browser-preferences";
import { catalog } from "@/cala/lib/i18n-catalog";
import { catalog2 } from "@/cala/lib/i18n-catalog-2";
import { advisorEnglish } from "@/cala/domain/analytics/advisor";

export type Locale = "es" | "en";
type Values = Record<string, string | number>;

const base: Record<string, string> = {
  Inicio: "Home",
  Calendario: "Calendar",
  Reservas: "Reservations",
  Inventario: "Inventory",
  "Tarifas y restricciones": "Rates & restrictions",
  Canales: "Channels",
  Housekeeping: "Housekeeping",
  Mantenimiento: "Maintenance",
  Finanzas: "Finance",
  Automatizaciones: "Automations",
  Reportes: "Reports",
  "Activity Center": "Activity Center",
  "Equipo y permisos": "Team & permissions",
  Configuración: "Settings",
  "Nueva propiedad": "New property",
  OPERACIÓN: "OPERATIONS",
  GESTIÓN: "MANAGEMENT",
  HERRAMIENTAS: "TOOLS",
  CONFIGURACIÓN: "SETTINGS",
  "Mi espacio": "My workspace",
  "Tu espacio": "Your workspace",
  "TU PROPIEDAD": "YOUR PROPERTY",
  "Sin propiedades": "No properties",
  "Configura tu primera propiedad": "Set up your first property",
  "Añadir al portafolio": "Add to portfolio",
  "Saltar al contenido": "Skip to content",
  "Abrir navegación": "Open navigation",
  "Cerrar sesión": "Sign out",
  "Buscar en CALA": "Search CALA",
  "Activity Center, {count} procesos activos":
    "Activity Center, {count} active processes",
  "Cambios guardados": "Changes saved",
  Nueva: "New",
  Más: "More",
  "Crear reserva": "Create reservation",
  "Añadir otro espacio al portafolio": "Add another space to the portfolio",
  Propiedad: "Property",
  "Cerrar sesión · {role}": "Sign out · {role}",
  "¿Qué necesitas hacer?": "What do you need to do?",
  "Buscar módulos o reservas": "Search modules or reservations",
  "Reservas, tarifas, EST…": "Reservations, rates, EST…",
  "Tu rol no tiene acceso a este módulo.":
    "Your role does not have access to this module.",
  "Abrir asistente de CALA": "Open CALA Assistant",
  "Opciones del asistente de CALA": "CALA Assistant options",
  "Asistente CALA": "CALA Assistant",
  Tutorial: "Tutorial",
  "Conoce la interfaz, Ajustes y herramientas.":
    "Explore the interface, Settings, and tools.",
  "Primeros pasos": "Getting started",
  "Configura una propiedad paso a paso.": "Set up a property step by step.",
  "No pudimos abrir tu espacio": "We couldn't open your workspace",
  "Intenta cargar CALA de nuevo.": "Try loading CALA again.",
  Reintentar: "Try again",
  "No se pudo cargar CALA.": "CALA could not be loaded.",
  "Hospitality, in flow.": "Hospitality, in flow.",
  "HOSPITALIDAD EN CALMA": "HOSPITALITY IN FLOW",
  "Tu operación fluye. La hospitalidad vuelve al centro.":
    "Your operation flows. Hospitality returns to center stage.",
  "Reservas, equipo, inventario y canales en un espacio sereno, preciso y hecho para acompañarte.":
    "Reservations, team, inventory, and channels in one calm, precise workspace built to support you.",
  "Un inicio claro.": "A clear start.",
  "CALA te acompaña paso a paso.": "CALA guides you step by step.",
  "UN ÚLTIMO PASO": "ONE LAST STEP",
  "Revisa tu correo": "Check your email",
  "Enviamos un enlace de confirmación a {email}. Al volver, tu espacio estará listo para recibirte.":
    "We sent a confirmation link to {email}. When you return, your workspace will be ready.",
  "Usar otro correo": "Use another email",
  EMPECEMOS: "LET'S BEGIN",
  "QUÉ GUSTO VERTE": "GOOD TO SEE YOU",
  "Bienvenido a CALA": "Welcome to CALA",
  "Vuelve a tu espacio": "Return to your workspace",
  "Crea tu cuenta. Después configuraremos CALA contigo, paso a paso.":
    "Create your account. Then we'll set up CALA with you, step by step.",
  "Ingresa para continuar donde lo dejaste.":
    "Sign in to continue where you left off.",
  "Tu nombre": "Your name",
  "¿Cómo te llamamos?": "What should we call you?",
  "Correo electrónico": "Email address",
  Contraseña: "Password",
  "Mínimo 10 caracteres.": "At least 10 characters.",
  "Preparando tu espacio…": "Preparing your workspace…",
  "Crear mi cuenta": "Create my account",
  "Entrar a CALA": "Sign in to CALA",
  "¿Ya tienes una cuenta?": "Already have an account?",
  "¿Aún no usas CALA?": "New to CALA?",
  "Inicia sesión": "Sign in",
  "Crea tu cuenta": "Create your account",
  "Al continuar aceptas los términos y el aviso de privacidad de CALA.":
    "By continuing, you accept CALA's terms and privacy notice.",
  "No pudimos completar el acceso.": "We couldn't complete sign-in.",
  Idioma: "Language",
  Español: "Spanish",
  English: "English",
  "Idioma de la interfaz": "Interface language",
  "CALA detecta el idioma de tu navegador. Puedes cambiarlo en cualquier momento.":
    "CALA detects your browser language. You can change it at any time.",
  "CADA ESTANCIA CUENTA": "EVERY STAY MATTERS",
  "Una vista clara, desde la primera noche hasta la despedida.":
    "A clear view, from the first night to farewell.",
  "Nueva reserva": "New reservation",
  "Buscar reservas": "Search reservations",
  "Buscar huésped o confirmación": "Search guest or confirmation",
  "Filtrar estado": "Filter by status",
  "Todos los estados": "All statuses",
  Confirmadas: "Confirmed",
  "En casa": "In house",
  Pendientes: "Pending",
  Canceladas: "Cancelled",
  Finalizadas: "Completed",
  Borradores: "Drafts",
  "No-show": "No-show",
  "{count} estancias": "{count} stays",
  "Todo listo por aquí": "Everything is ready here",
  "Los nuevos registros aparecerán en este espacio.":
    "New records will appear in this space.",
  Cerrar: "Close",
  Cancelar: "Cancel",
  Guardar: "Save",
  "Guardando…": "Saving…",
  "No se pudo guardar.": "Changes could not be saved.",
  Atrás: "Back",
  Continuar: "Continue",
  Finalizar: "Finish",
  "Paso {step} de {total}": "Step {step} of {total}",
  Huésped: "Guest",
  Estancia: "Stay",
  Unidad: "Unit",
  Estado: "Status",
  Importe: "Amount",
  Abrir: "Open",
  "Sin asignar": "Unassigned",
  "{count} huéspedes": "{count} guests",
  "Huésped · acceso restringido": "Guest · restricted access",
  Confirmada: "Confirmed",
  Pendiente: "Pending",
  Borrador: "Draft",
  "Selección de huésped": "Guest selection",
  "Elige un huésped existente o registra sus datos sin salir de la reserva.":
    "Choose an existing guest or enter their details without leaving the reservation.",
  "Huésped existente": "Existing guest",
  "Nuevo huésped": "New guest",
  "Selecciona un huésped": "Select a guest",
  Nombre: "First name",
  Apellidos: "Last name",
  "Teléfono internacional": "International phone",
  País: "Country",
  "Notas autorizadas": "Authorized notes",
  "Formato E.164, por ejemplo +525512345678":
    "E.164 format, for example +12025550123",
  "Datos de estancia": "Stay details",
  "Define fechas, alojamiento y ocupación. CALA validará disponibilidad y precio.":
    "Set dates, accommodation, and occupancy. CALA will validate availability and price.",
  "Tipo de alojamiento": "Accommodation type",
  "Asignar más tarde": "Assign later",
  "Plan de tarifas": "Rate plan",
  "Estado inicial": "Initial status",
  Llegada: "Arrival",
  Salida: "Departure",
  Adultos: "Adults",
  Menores: "Children",
  "Notas de la estancia": "Stay notes",
  "Resumen e invoice": "Summary & invoice",
  "Revisa la reserva antes de crearla. Puedes preparar el invoice automáticamente.":
    "Review the reservation before creating it. You can prepare the invoice automatically.",
  "Preparar invoice al crear": "Prepare invoice after creation",
  "Se abrirá una vista elegante, lista para imprimir o guardar como PDF.":
    "An elegant view will open, ready to print or save as PDF.",
  "Crear reserva y generar invoice": "Create reservation & generate invoice",
  "Crear reserva sin invoice": "Create reservation without invoice",
  "Falta configurar el inventario": "Inventory setup is required",
  "Configura al menos un tipo de alojamiento antes de crear una reserva.":
    "Set up at least one accommodation type before creating a reservation.",
  "Ir a inventario": "Go to inventory",
  "Editar estancia": "Edit stay",
  "La disponibilidad y el precio se validan al guardar. Los importes usan las tarifas y restricciones de cada noche.":
    "Availability and price are validated when saving. Amounts use each night's rates and restrictions.",
  "Guardar cambios": "Save changes",
  "Editar datos del huésped": "Edit guest details",
  "Guardar huésped": "Save guest",
  Invoice: "Invoice",
  "Generar invoice": "Generate invoice",
  "Invoice de reserva": "Reservation invoice",
  "Emitido por CALA": "Issued by CALA",
  "COMPROBANTE DE RESERVA": "RESERVATION INVOICE",
  "No es un comprobante fiscal.": "This is not a tax invoice.",
  "Emitido para": "Issued for",
  "Preparado por": "Prepared by",
  "Facturado a": "Billed to",
  Reserva: "Reservation",
  Descripción: "Description",
  Cantidad: "Quantity",
  Precio: "Price",
  Total: "Total",
  "Alojamiento · {nights} noches": "Accommodation · {nights} nights",
  "Información de la estancia": "Stay information",
  "Imprimir / Guardar PDF": "Print / Save PDF",
  "Editar / mover": "Edit / move",
  "Ver folio": "View folio",
  "Confirmar reserva": "Confirm reservation",
  "Realizar check-in": "Check in",
  "Realizar check-out": "Check out",
  "Cancelar reserva": "Cancel reservation",
  "Marcar no-show": "Mark no-show",
  "Confirmar cambio": "Confirm change",
  Volver: "Go back",
  "El cambio quedará registrado y actualizará la disponibilidad cuando corresponda.":
    "The change will be recorded and availability will update when applicable.",
  "Actividad de esta estancia": "Stay activity",
  "Reserva creada": "Reservation created",
  Alojamiento: "Accommodation",
  Origen: "Source",
  Directo: "Direct",
  "Importación / canal": "Import / channel",
  "Total del folio": "Folio total",
  "Saldo pendiente": "Outstanding balance",
  LLEGADA: "ARRIVAL",
  SALIDA: "DEPARTURE",
  noche: "night",
  noches: "nights",
  "UN ESPACIO A TU MANERA": "A WORKSPACE YOUR WAY",
  "Tu organización, tus preferencias y la identidad de cada propiedad.":
    "Your organization, preferences, and each property's identity.",
  Apariencia: "Appearance",
  "El mismo espacio de trabajo, con una atmósfera diferente.":
    "The same workspace, with a different atmosphere.",
  "Tema {name} aplicado": "{name} theme applied",
  "Densidad de escritorio": "Desktop density",
  Cómoda: "Comfortable",
  Compacta: "Compact",
  "Tamaño de texto": "Text size",
  Normal: "Normal",
  Mediano: "Medium",
  Grande: "Large",
  "Tamaño de texto: {size}": "Text size: {size}",
  "El tamaño de texto se adapta a cada dispositivo: en calendarios y etiquetas compactas crece menos para no romper la composición.":
    "Text size adapts to each device: calendars and compact labels grow less so the layout stays intact.",
  "Tablet y móvil conservan controles táctiles. Las animaciones permanecen activas en todas las composiciones.":
    "Tablet and mobile keep touch-safe controls. Animations remain active in every layout.",
  Organización: "Organization",
  "Crear organización": "Create organization",
  "Organización activa": "Active organization",
  "Datos de {name}": "{name} details",
  "Los cambios se autorizan y guardan en servidor.":
    "Changes are authorized and saved on the server.",
  Ciudad: "City",
  "Sobreventa agrupada permitida": "Allowed grouped overbooking",
  "No autoriza solapamientos de una misma unidad física.":
    "This does not allow overlapping stays in the same physical unit.",
  Política: "Policy",
  "Tu rol permite consultar; no modificar esta propiedad.":
    "Your role allows viewing, but not editing this property.",
  "Nueva organización": "New organization",
};

const english: Record<string, string> = {
  ...catalog,
  ...catalog2,
  ...advisorEnglish,
  ...base,
};

function interpolate(message: string, values?: Values) {
  if (!values) return message;
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    message,
  );
}

export function translate(locale: Locale, source: string, values?: Values) {
  return interpolate(
    locale === "en" ? (english[source] ?? source) : source,
    values,
  );
}

let memoryLocale: Locale | undefined;
const localeListeners = new Set<() => void>();
function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    localeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function detectLocale(): Locale {
  if (typeof window === "undefined") return "es";
  if (memoryLocale) return memoryLocale;
  const saved = browserPreferences.getItem("cala-locale");
  if (saved === "es" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string, values?: Values) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  /** Read by the server from the cala-locale cookie: the first paint (and
   *  hydration) already uses the chosen language. */
  initialLocale?: Locale;
}) {
  const locale = useSyncExternalStore(
    subscribeLocale,
    detectLocale,
    () => initialLocale ?? ("es" as const),
  );

  const setLocale = useCallback((next: Locale) => {
    memoryLocale = next;
    // Set before re-rendering so Intl dates and amounts use the new locale.
    document.documentElement.lang = next === "es" ? "es-MX" : "en-US";
    browserPreferences.setItem("cala-locale", next);
    localeListeners.forEach((listener) => listener());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "es" ? "es-MX" : "en-US";
    // Strings rendered without t() (and server messages shown in toasts) are
    // translated at the DOM level, so the whole interface switches language.
    if (locale === "en") return startDomTranslation();
    restoreDomTranslation();
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (source, values) => translate(locale, source, values),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `t()` for components that may render outside LocaleProvider (loaders). */
export function useOptionalT() {
  const context = useContext(I18nContext);
  return (
    context?.t ??
    ((source: string, values?: Values) => translate("es", source, values))
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("I18n context missing");
  return context;
}

export function intlLocale(locale: Locale) {
  return locale === "es" ? "es-MX" : "en-US";
}


/* ------------------------------------------------------------------------ */
/* DOM translator                                                            */
/* ------------------------------------------------------------------------ */
const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP = "script,style,textarea,code,pre,[contenteditable],[data-no-translate],[translate='no']";
let patterns: Array<[RegExp, string, string[]]> | null = null;
function compiledPatterns() {
  if (patterns) return patterns;
  patterns = Object.entries(english)
    .filter(([key]) => /\{\w+\}/.test(key))
    .map(([key, value]) => {
      const names: string[] = [];
      const source = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const name = /^\{(\w+)\}$/.exec(part)?.[1];
          if (name) {
            names.push(name);
            return "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return [new RegExp("^" + source + "$"), value, names] as [
        RegExp,
        string,
        string[],
      ];
    });
  return patterns;
}
export function translateLoose(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || !/[A-Za-zÁÉÍÓÚÑáéíóúñ¿¡]/.test(trimmed)) return null;
  const direct = english[trimmed];
  if (direct !== undefined)
    return direct === trimmed ? null : text.replace(text.trim(), direct);
  for (const [re, value, names] of compiledPatterns()) {
    const match = re.exec(trimmed);
    if (!match) continue;
    let out = value;
    names.forEach((name, i) => {
      out = out.replaceAll(`{${name}}`, match[i + 1]);
    });
    return text.replace(text.trim(), out);
  }
  return null;
}
const textOriginal = new Map<Text, { source: string; shown: string }>();
const attrOriginal = new Map<Element, Record<string, { source: string; shown: string }>>();
let observer: MutationObserver | null = null;

function translateTextNode(node: Text) {
  const value = node.nodeValue ?? "";
  const known = textOriginal.get(node);
  if (known && known.shown === value) return;
  if (node.parentElement?.closest(SKIP)) return;
  const out = translateLoose(value);
  if (out === null || out === value) {
    if (known) textOriginal.delete(node);
    return;
  }
  textOriginal.set(node, { source: value, shown: out });
  node.nodeValue = out;
}
function translateAttributes(element: Element) {
  if (element.closest(SKIP)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const record = attrOriginal.get(element) ?? {};
    if (record[name]?.shown === value) continue;
    const out = translateLoose(value);
    if (out === null || out === value) continue;
    record[name] = { source: value, shown: out };
    attrOriginal.set(element, record);
    element.setAttribute(name, out);
  }
}
function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  translateAttributes(element);
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
    else translateAttributes(node as Element);
  }
}
function startDomTranslation() {
  if (typeof document === "undefined" || observer) return () => {};
  translateTree(document.body);
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") translateTextNode(m.target as Text);
      else if (m.type === "attributes") translateAttributes(m.target as Element);
      else m.addedNodes.forEach(translateTree);
    }
    if (textOriginal.size > 5000)
      for (const node of textOriginal.keys())
        if (!node.isConnected) textOriginal.delete(node);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTES],
  });
  return () => {
    observer?.disconnect();
    observer = null;
  };
}
function restoreDomTranslation() {
  if (typeof document === "undefined") return;
  observer?.disconnect();
  observer = null;
  for (const [node, { source, shown }] of textOriginal)
    if (node.isConnected && node.nodeValue === shown) node.nodeValue = source;
  textOriginal.clear();
  for (const [element, record] of attrOriginal)
    for (const [name, { source, shown }] of Object.entries(record))
      if (element.isConnected && element.getAttribute(name) === shown)
        element.setAttribute(name, source);
  attrOriginal.clear();
}
