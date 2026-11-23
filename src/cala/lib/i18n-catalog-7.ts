/** English catalog for CALA (part 8): notification bell, browser push,
 *  one-tap tasks and automation rules that alert roles. */
export const catalog7: Record<string, string> = {
  // Bell
  Notificaciones: "Notifications",
  "Notificaciones, {count} sin leer": "Notifications, {count} unread",
  "Marcar todo como leído": "Mark all as read",
  "Avisos activados en este dispositivo": "Alerts are on for this device",
  Probar: "Test",
  Desactivar: "Turn off",
  "Recibe estos avisos aunque CALA esté cerrado.": "Get these alerts even when CALA is closed.",
  "Activar en este dispositivo": "Turn on for this device",
  "Las notificaciones están bloqueadas para CALA. Permítelas en los ajustes del navegador y vuelve a intentarlo.":
    "Notifications are blocked for CALA. Allow them in your browser settings and try again.",
  "En iPhone y iPad, añade CALA a la pantalla de inicio (Compartir → Añadir a inicio) para recibir avisos.":
    "On iPhone and iPad, add CALA to your Home Screen (Share → Add to Home Screen) to receive alerts.",
  "Este navegador no admite notificaciones. Los avisos siguen apareciendo aquí.":
    "This browser doesn't support notifications. Alerts still appear here.",
  "Las notificaciones se activarán cuando se aplique la actualización de la base de datos.":
    "Notifications will start once the database update is applied.",
  "Sin notificaciones por ahora. Aquí verás lo que tu rol necesita saber.":
    "No notifications yet. You'll see here what your role needs to know.",
  "Procesos en segundo plano": "Background processes",
  "Listo. Te enviamos un aviso de prueba a este dispositivo.": "Done. We sent a test alert to this device.",
  "Aviso de prueba enviado.": "Test alert sent.",
  "Las notificaciones del navegador aún no están configuradas en el servidor (faltan las claves VAPID).":
    "Browser notifications aren't set up on the server yet (VAPID keys are missing).",
  "No se pudieron activar las notificaciones.": "Notifications couldn't be turned on.",
  // Notification titles written by the database
  "Check-in realizado": "Checked in",
  "Check-out realizado": "Checked out",
  "Tarea asignada a ti": "Task assigned to you",
  "Nueva tarea de limpieza": "New housekeeping task",
  "Nueva tarea de mantenimiento": "New maintenance task",
  "Tarea completada": "Task completed",
  "Pago recibido con tarjeta": "Card payment received",
  "Pago web en revisión": "Website payment needs review",
  "Notificaciones activadas": "Notifications turned on",
  "Mensaje de {name}": "Message from {name}",
  // One-tap tasks
  "Asignadas a mí": "Assigned to me",
  Empezar: "Start",
  "Tarea en proceso": "Task in progress",
  "Tarea reabierta": "Task reopened",
  "Esta tarea está asignada a otra persona. Solo ella o un responsable (propietario, administrador o gerente) puede cerrarla.":
    "This task is assigned to someone else. Only they or a lead (owner, admin or manager) can close it.",
  "Elige cuándo se ejecuta la regla.": "Choose when the rule runs.",
  "Elige un estado válido para la tarea.": "Choose a valid task status.",
  "Elige si la tarea es de limpieza o de mantenimiento.": "Choose whether it's a housekeeping or maintenance task.",
  "Esa persona no tiene acceso a esta propiedad.": "That person has no access to this property.",
  // Automations
  "Reglas que reaccionan a tus reservas: crean tareas y avisan a quien corresponde, en la campana y como notificación del navegador.":
    "Rules that react to your bookings: they create tasks and alert the right people, in the bell and as browser notifications.",
  "Reserva nueva (confirmada)": "New booking (confirmed)",
  "Solo avisar": "Only alert",
  "Crear una tarea y avisar": "Create a task and alert",
  "Sin notificaciones": "No notifications",
  "Avisa a: Propietario, Administrador, Gerente": "Alerts: Owner, Administrator, Manager",
  "Por ejemplo: cada check-out crea la limpieza de la habitación y avisa a Limpieza en su teléfono.":
    "For example: every check-out creates the room's cleaning and alerts Housekeeping on their phone.",
  "Usar este ejemplo": "Use this example",
  "Nombre de la regla *": "Rule name *",
  "Cuando ocurra *": "When this happens *",
  "Realizar esta acción *": "Do this *",
  "Tipo de tarea": "Task type",
  "Título de la tarea": "Task title",
  "Asignar la tarea a": "Assign the task to",
  "Sin asignar (la toma quien esté disponible)": "Unassigned (whoever is free takes it)",
  "Avisar a (campana y notificación del navegador)": "Alert (bell and browser notification)",
  "Ve tareas y unidades, nunca datos del huésped.": "Sees tasks and units, never guest data.",
  "Reservas, huéspedes y tareas.": "Bookings, guests and tasks.",
  "Solo pagos y finanzas.": "Payments and finance only.",
  "Solo recibe el aviso quien tenga ese rol y acceso a esta propiedad. Los roles sin acceso a datos de huéspedes ven el aviso sin nombres.":
    "Only people with that role and access to this property get the alert. Roles without access to guest data see it without names.",
  "Sin roles elegidos se avisa a Propietario, Administrador y Gerente.": "With no roles selected, Owner, Administrator and Manager are alerted.",
  "Sin roles elegidos la regla solo crea la tarea (quien la tenga asignada recibe su aviso).":
    "With no roles selected the rule only creates the task (the assignee still gets their alert).",
  "Avisar solo si la habitación tiene tareas por hacer (limpiar, reparar…)": "Alert only if the room has tasks to do (cleaning, repairs…)",
  "Las acciones se ejecutan una sola vez por reserva y evento. No se permiten operaciones financieras automáticas.":
    "Actions run once per booking and event. Automatic financial operations are not allowed.",
  "Guardar regla": "Save rule",
  "Ponle un nombre a la regla.": "Give the rule a name.",
  "Limpieza tras check-out": "Cleaning after check-out",
  "Limpieza de salida": "Departure cleaning",
  "Cuando: {trigger}": "When: {trigger}",
  "Acción: Solo avisar": "Action: Only alert",
  "Avisa a: {roles}": "Alerts: {roles}",
};
