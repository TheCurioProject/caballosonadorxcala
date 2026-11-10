"use client";
import { useState } from "react";
import { useWorkspace } from "./context";
import { ReservationInspector } from "@/cala/features/reservations/components";
import { dateTime } from "@/cala/lib/format";
const actions: Record<string, string> = {
  "site.reservation.sync": "Reserva actualizada desde la web",
  "site.reservation.deleted": "Reserva retirada de la web",
  "stripe.payment.received": "Pago recibido por Stripe",
  "reservation.save": "Reserva guardada",
  "reservation.move": "Estancia reubicada",
  "reservation.transition": "Estado de reserva actualizado",
  "guest.save": "Contacto actualizado",
  "block.create": "Fechas bloqueadas",
  "block.release": "Fechas liberadas",
  "rates.bulk": "Tarifas actualizadas",
  "message.save": "Mensaje o nota guardado",
  "workspace.preferences.save": "Preferencias actualizadas",
};
export function RecentActivity() {
  const { data, can } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  if (!can("audit.read")) return null;
  const entries = data.audits
    .filter((a) => a.propertyId === data.currentPropertyId)
    .slice()
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    )
    .slice(0, 8);
  return (
    <section className="panel recent-activity">
      <h2>Actividad reciente</h2>
      {entries.length ? (
        <ul>
          {entries.map((a) => {
            const reservation = data.reservations.find(
              (r) => r.id === a.entityId,
            );
            return (
              <li key={a.id}>
                <div>
                  <strong>{actions[a.action] ?? a.action}</strong>
                  <small>{dateTime(a.createdAt)}</small>
                </div>
                {reservation && (
                  <button
                    className="button secondary"
                    onClick={() => setSelected(reservation.id)}
                  >
                    {reservation.confirmationCode}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Los cambios de esta propiedad aparecerán aquí.</p>
      )}
      {selected && (
        <ReservationInspector id={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
