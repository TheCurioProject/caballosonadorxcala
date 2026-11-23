/** English catalog for CALA (part 9): reservation trash — delete, recover
 *  within 10 days, permanent deletion. */
export const catalog8: Record<string, string> = {
  "Eliminar reserva": "Delete reservation",
  "¿Eliminar esta reserva?": "Delete this reservation?",
  "Se moverá a la papelera y sus fechas quedarán libres en CALA y en la página web. Podrás recuperarla durante 10 días; después se borrará definitivamente.":
    "It will move to the trash and its dates will be freed in CALA and on the website. You can recover it for 10 days; after that it is deleted permanently.",
  "El huésped figura en casa. Elimínala solo si la estancia nunca ocurrió.":
    "The guest is marked as in-house. Delete it only if the stay never happened.",
  "Tiene pagos registrados. Si no la recuperas, también se borrarán de CALA (Stripe conserva su propio registro).":
    "It has recorded payments. If you don't recover it, they will also be deleted from CALA (Stripe keeps its own record).",
  "Eliminando…": "Deleting…",
  "Mover a la papelera": "Move to trash",
  Papelera: "Trash",
  "Papelera ({count})": "Trash ({count})",
  "Papelera de reservas": "Reservation trash",
  "Las reservas eliminadas se guardan aquí 10 días. Mientras tanto no ocupan fechas y puedes recuperarlas; después se borran definitivamente.":
    "Deleted reservations stay here for 10 days. Meanwhile they don't hold any dates and you can recover them; after that they are deleted permanently.",
  "La papelera está vacía": "The trash is empty",
  "Las reservas que elimines aparecerán aquí.": "Reservations you delete will appear here.",
  "Eliminada {date}": "Deleted {date}",
  "Se borrará en breve": "Will be deleted shortly",
  "Se borrará definitivamente en 1 día": "Permanently deleted in 1 day",
  "Se borrará definitivamente en {days} días": "Permanently deleted in {days} days",
  "¿Borrar para siempre? No se puede deshacer.": "Delete forever? This can't be undone.",
  "Borrando…": "Deleting…",
  "Borrar definitivamente": "Delete permanently",
  Recuperar: "Recover",
  "Recuperando…": "Recovering…",
  "Borrar ya": "Delete now",
  // Server messages
  "Reserva enviada a la papelera. Puedes recuperarla durante 10 días.":
    "Reservation moved to the trash. You can recover it for 10 days.",
  "Reserva recuperada.": "Reservation recovered.",
  "Reserva borrada definitivamente.": "Reservation permanently deleted.",
  "Esta reserva está en la papelera. Recupérala para editarla.":
    "This reservation is in the trash. Recover it to edit it.",
  "Esta reserva ya está en la papelera.": "This reservation is already in the trash.",
  "La reserva ya no está en la papelera: se recuperó o se borró definitivamente. Recarga la vista.":
    "The reservation is no longer in the trash: it was recovered or permanently deleted. Reload the view.",
  "La reserva ya no está en la papelera.": "The reservation is no longer in the trash.",
};
