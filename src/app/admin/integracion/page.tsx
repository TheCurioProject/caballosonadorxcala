import { requireAdmin, requireAdminPage } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireAdminPage();
  const alerts = await prisma.$queryRaw<
    Array<{
      id: string;
      booking_id: number;
      code: string;
      guestName: string;
      start: string;
      end: string;
    }>
  >`SELECT a.id,a.booking_id,a.code,b."guestName",b.start_date::date::text AS start,b.end_date::date::text AS end FROM site.integration_alerts a JOIN site.reservas b ON b.id=a.booking_id WHERE a.status='open' ORDER BY a.created_at DESC LIMIT 200`;
  return (
    <div className="space-y-8">
      <h1>Revisión de la integración</h1>
      <p>
        Los pagos con conflicto se registran en Finanzas y su reserva queda en
        borrador. Comprueba la disponibilidad y acuerda una solución con el
        huésped antes de confirmar la estancia o gestionar un reembolso en
        Stripe.
      </p>
      {alerts.length ? (
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>
              <strong>
                Reserva web #{alert.booking_id} · {alert.guestName}
              </strong>
              <p>
                {alert.start} → {alert.end} · Pago recibido con conflicto de
                inventario.
              </p>
              <Link href="/admin/reservas?status=draft">
                Revisar reservas en CALA
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="notice">No hay pagos pendientes de revisión.</p>
      )}
      <Link href="/admin/finanzas">Abrir Finanzas</Link>
    </div>
  );
}
