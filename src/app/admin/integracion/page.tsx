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
  // Tailwind like the other website modules (CALA's element styles do not
  // reach .site-module, so bare h1/p/a rendered as plain text).
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-3xl text-[#2C2927]">Revisión de la integración</h1>
        <p className="text-gray-500 mt-1 max-w-3xl">
          Los pagos con conflicto se registran en Finanzas y su reserva queda en
          borrador. Comprueba la disponibilidad y acuerda una solución con el
          huésped antes de confirmar la estancia o gestionar un reembolso en
          Stripe.
        </p>
      </div>
      {alerts.length ? (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[#2C2927] break-words">
                  Reserva web #{alert.booking_id} · <span data-no-translate>{alert.guestName}</span>
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {alert.start} → {alert.end} · Pago recibido con conflicto de
                  inventario.
                </p>
              </div>
              <Link href="/admin/reservas?status=draft" className="shrink-0 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors text-sm text-center">
                Revisar reservas en CALA
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">No hay pagos pendientes de revisión.</p>
      )}
      <Link href="/admin/finanzas" className="inline-flex items-center justify-center bg-[#2C2927] text-white px-5 py-2.5 rounded-lg hover:bg-black transition-colors">
        Abrir Finanzas
      </Link>
    </div>
  );
}
