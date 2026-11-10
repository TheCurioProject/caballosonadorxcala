export const uiLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang === "en-US"
    ? "en-US"
    : "es-MX";
const activeLocale = () =>
  typeof document !== "undefined" && document.documentElement.lang === "en-US"
    ? "en-US"
    : "es-MX";

export const money = (amount: number, currency = "MXN") =>
  new Intl.NumberFormat(activeLocale(), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export const shortDate = (date: string) =>
  new Intl.DateTimeFormat(activeLocale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat(activeLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const statusLabels: Record<string, string> = {
  draft: "Borrador",
  pending: "Pendiente",
  confirmed: "Confirmada",
  checked_in: "En casa",
  checked_out: "Finalizada",
  cancelled: "Cancelada",
  no_show: "No se presentó",
  clean: "Limpia",
  dirty: "Por limpiar",
  inspected: "Inspeccionada",
  in_progress: "En proceso",
  completed: "Completado",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Necesita atención",
  queued: "En cola",
  running: "En proceso",
  review: "Requiere revisión",
  retry: "Reintentando",
  dead_letter: "Requiere atención",
  succeeded: "Aprobado",
  failed: "Fallido",
  sent: "Enviado",
  received: "Recibido",
  active: "Activo",
  suspended: "Suspendido",
};
