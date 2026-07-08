'use client';

import { useTransition } from 'react';
import { clearPendingBookings } from './actions';
import { Loader2, Trash2 } from 'lucide-react';

export default function ClearPendingButton({ all = false, label = 'Limpiar Caducados' }: { all?: boolean, label?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (confirm(all ? '¿Estás seguro de que quieres eliminar TODAS las reservas pendientes de pago (bloqueos temporales)?' : '¿Estás seguro de que quieres limpiar los bloqueos caducados (más de 15 minutos)?')) {
          startTransition(async () => {
            const res = await clearPendingBookings(all);
            if (res.success) {
              alert(`Se han eliminado ${res.count} bloqueos temporales.`);
            } else {
              alert('Hubo un error al limpiar los bloqueos.');
            }
          });
        }
      }}
      disabled={isPending}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-md transition-colors ${
        all 
          ? 'bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50'
          : 'bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-50'
      }`}
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Trash2 className="w-3 h-3" />
      )}
      {isPending ? 'Procesando...' : label}
    </button>
  );
}
