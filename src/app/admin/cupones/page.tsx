'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Tag, Copy, Check, Shuffle, Percent, Banknote, AlertTriangle } from 'lucide-react';
import { CalaSpinner as Loader2 } from '@/cala/components/ui/cala-loader';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';
import { AdminToast } from '@/components/admin/AdminToast';
import { SiteModulePortal } from '@/components/admin/SiteModulePortal';

interface Coupon {
  id: number;
  code: string;
  description: string | null;
  type: 'percent' | 'fixed';
  value: number;
  minTotal: number;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  isActive: boolean;
  used: number;
  pending: number;
  discountedMinor: number;
}
type Draft = {
  id?: number;
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: string;
  minTotal: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  isActive: boolean;
};

const emptyDraft = (): Draft => ({ code: '', description: '', type: 'percent', value: '', minTotal: '', validFrom: '', validUntil: '', maxRedemptions: '', isActive: true });
const draftOf = (c: Coupon): Draft => ({
  id: c.id, code: c.code, description: c.description ?? '', type: c.type, value: String(c.value), minTotal: c.minTotal ? String(c.minTotal) : '',
  validFrom: c.validFrom ?? '', validUntil: c.validUntil ?? '', maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '', isActive: c.isActive,
});
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })} MXN`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan' }).format(new Date());
const day = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const randomCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'CCS-' + Array.from(bytes, b => letters[b % letters.length]).join('');
};

type Status = { label: string; tone: string };
function statusOf(c: Coupon): Status {
  const now = today();
  if (!c.isActive) return { label: 'Pausado', tone: 'bg-gray-100 text-gray-600' };
  if (c.validUntil && now > c.validUntil) return { label: 'Vencido', tone: 'bg-red-50 text-red-700' };
  if (c.maxRedemptions != null && c.used >= c.maxRedemptions) return { label: 'Agotado', tone: 'bg-amber-50 text-amber-800' };
  if (c.validFrom && now < c.validFrom) return { label: 'Programado', tone: 'bg-blue-50 text-blue-700' };
  return { label: 'Activo', tone: 'bg-green-100 text-green-700' };
}
const discountLabel = (c: Pick<Coupon, 'type' | 'value'>) => (c.type === 'percent' ? `${c.value}%` : money(c.value));
function validity(c: Coupon) {
  if (c.validFrom && c.validUntil) return `${day(c.validFrom)} – ${day(c.validUntil)}`;
  if (c.validFrom) return `Desde ${day(c.validFrom)}`;
  if (c.validUntil) return `Hasta ${day(c.validUntil)}`;
  return 'Sin fecha límite';
}

const field = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none';
const label = 'block text-sm font-medium text-gray-700 mb-2';

export default function CouponsAdmin() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stripeReady, setStripeReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons/', { cache: 'no-store' });
      if (res.status === 503) { setPending(true); return; }
      const data = await res.json();
      if (Array.isArray(data.coupons)) { setCoupons(data.coupons); setStripeReady(Boolean(data.stripe)); }
    } catch {
      setToast({ message: 'No pudimos cargar los cupones. Recarga la página.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const open = (coupon?: Coupon) => { setDraft(coupon ? draftOf(coupon) : emptyDraft()); setFormError(''); };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));

  const post = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/coupons/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo guardar el cupón.');
    return data as Coupon;
  };
  const payloadOf = (d: Draft) => ({
    ...(d.id ? { id: d.id } : {}),
    code: d.code,
    description: d.description.trim() || null,
    type: d.type,
    value: Number(d.value),
    minTotal: d.minTotal ? Number(d.minTotal) : 0,
    validFrom: d.validFrom || null,
    validUntil: d.validUntil || null,
    maxRedemptions: d.maxRedemptions ? Number(d.maxRedemptions) : null,
    isActive: d.isActive,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const value = Number(draft.value);
    if (!draft.code.trim()) return setFormError('Escribe el código del cupón.');
    if (!Number.isFinite(value) || value <= 0 || (draft.type === 'percent' && value > 100)) return setFormError('Escribe un descuento válido (el porcentaje va de 1 a 100).');
    if (draft.maxRedemptions && (!Number.isInteger(Number(draft.maxRedemptions)) || Number(draft.maxRedemptions) < 1)) return setFormError('El límite de usos debe ser un número entero.');
    setSaving(true);
    setFormError('');
    try {
      await post(payloadOf(draft));
      setDraft(null);
      setToast({ message: draft.id ? 'Cupón actualizado.' : 'Cupón creado. Ya se puede usar en la web.', type: 'success' });
      await load();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: Coupon) => {
    try {
      await post({ ...payloadOf(draftOf(coupon)), isActive: !coupon.isActive });
      setToast({ message: coupon.isActive ? 'Cupón pausado: ya no se puede usar.' : 'Cupón activado.', type: 'success' });
      await load();
    } catch (error) {
      setToast({ message: (error as Error).message, type: 'error' });
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/coupons/?id=${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setToast({ message: 'Cupón eliminado.', type: 'success' });
      setToDelete(null);
      await load();
    } catch {
      setToast({ message: 'No se pudo eliminar el cupón.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const copy = async (coupon: Coupon) => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(coupon.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setToast({ message: 'No se pudo copiar el código.', type: 'error' });
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[#2C2927]">Cupones</h1>
          <p className="text-gray-500 mt-1">Códigos de descuento para las reservas de la web. El huésped lo escribe en el resumen y Stripe cobra el total ya con descuento.</p>
        </div>
        {!pending && (
          <button onClick={() => open()} className="bg-[#9B7E67] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#8A6D56] transition-colors whitespace-nowrap">
            <Plus size={18} />
            Nuevo cupón
          </button>
        )}
      </div>

      {!loading && !pending && !stripeReady && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-900 rounded-xl p-4 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>Stripe no está configurado en este entorno: los cupones se guardan, pero no se podrán cobrar hasta conectar Stripe.</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#9B7E67]" size={32} />
        </div>
      ) : pending ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Tag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">Falta activar esta sección en la base de datos.</p>
          <p className="text-gray-500 text-sm mt-1">Cuando se active podrás crear cupones aquí.</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Tag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Aún no hay cupones.</p>
          <button onClick={() => open()} className="text-[#9B7E67] hover:underline mt-2">Crea el primer cupón</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {coupons.map(coupon => {
            const status = statusOf(coupon);
            const usable = status.label === 'Activo';
            return (
              <motion.div
                key={coupon.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl border border-gray-200 ${usable ? 'shadow-sm' : 'opacity-80'} p-6 flex flex-col gap-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button onClick={() => void copy(coupon)} title="Copiar código" className="group flex items-center gap-2 max-w-full">
                      <span className="font-mono text-xl font-bold tracking-wider text-[#2C2927] truncate" data-no-translate>{coupon.code}</span>
                      {copied === coupon.id ? <Check size={16} className="text-green-600 shrink-0" /> : <Copy size={16} className="text-gray-400 group-hover:text-[#9B7E67] shrink-0" />}
                    </button>
                    {coupon.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2" data-no-translate>{coupon.description}</p>}
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${status.tone}`}>{status.label}</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-4xl text-[#9B7E67]" data-no-translate>{discountLabel(coupon)}</span>
                  <span className="text-gray-500">de descuento</span>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wider">Vigencia</dt>
                    <dd className="text-gray-700 mt-0.5">{validity(coupon)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wider">Usos</dt>
                    <dd className="text-gray-700 mt-0.5" data-no-translate>
                      {coupon.used}{coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ''}
                      {coupon.pending > 0 && <span className="text-gray-400"> (+{coupon.pending})</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wider">Compra mínima</dt>
                    <dd className="text-gray-700 mt-0.5">{coupon.minTotal > 0 ? <span data-no-translate>{money(coupon.minTotal)}</span> : 'Sin mínimo'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs uppercase tracking-wider">Descuento otorgado</dt>
                    <dd className="text-gray-700 mt-0.5" data-no-translate>{money(coupon.discountedMinor / 100)}</dd>
                  </div>
                </dl>

                <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100 mt-auto">
                  <button onClick={() => void toggle(coupon)} className="text-sm font-medium text-gray-600 hover:text-[#9B7E67] transition-colors">
                    {coupon.isActive ? 'Pausar' : 'Activar'}
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => open(coupon)} title="Editar cupón" aria-label="Editar cupón" className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setToDelete(coupon)} title="Eliminar cupón" aria-label="Eliminar cupón" className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <SiteModulePortal>
      <AnimatePresence>
        {draft && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setDraft(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white sm:rounded-2xl shadow-2xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-[#F9F7F4]">
                <h2 className="font-serif text-2xl text-[#2C2927]">{draft.id ? 'Editar cupón' : 'Nuevo cupón'}</h2>
                <button onClick={() => setDraft(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
                <form id="couponForm" onSubmit={save} className="space-y-6">
                  <div>
                    <label className={label} htmlFor="coupon-code">Código <span className="text-gray-400 font-normal">(lo que escribe el huésped)</span></label>
                    <div className="flex gap-2">
                      <input
                        id="coupon-code"
                        type="text"
                        value={draft.code}
                        onChange={e => set('code', e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        maxLength={32}
                        autoComplete="off"
                        spellCheck={false}
                        className={`${field} font-mono tracking-wider uppercase`}
                        placeholder="VERANO10"
                      />
                      <button type="button" onClick={() => set('code', randomCode())} title="Generar un código al azar" className="px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap">
                        <Shuffle size={16} />
                        Generar
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className={label}>Tipo de descuento</span>
                    <div className="grid grid-cols-2 gap-3">
                      {([['percent', 'Porcentaje', Percent], ['fixed', 'Monto fijo (MXN)', Banknote]] as const).map(([type, text, Icon]) => (
                        <button
                          key={type}
                          type="button"
                          aria-pressed={draft.type === type}
                          onClick={() => set('type', type)}
                          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${draft.type === type ? 'border-[#9B7E67] bg-[#9B7E67]/10 text-[#2C2927]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          <Icon size={16} />
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="coupon-value">{draft.type === 'percent' ? 'Descuento (%)' : 'Descuento (MXN)'}</label>
                      <input id="coupon-value" type="number" inputMode="decimal" min={0} max={draft.type === 'percent' ? 100 : undefined} step="any" value={draft.value} onChange={e => set('value', e.target.value)} className={field} placeholder={draft.type === 'percent' ? '10' : '500'} />
                    </div>
                    <div>
                      <label className={label} htmlFor="coupon-min">Compra mínima (MXN) <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <input id="coupon-min" type="number" inputMode="decimal" min={0} step="any" value={draft.minTotal} onChange={e => set('minTotal', e.target.value)} className={field} placeholder="Sin mínimo" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="coupon-from">Válido desde <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <input id="coupon-from" type="date" value={draft.validFrom} onChange={e => set('validFrom', e.target.value)} className={field} />
                    </div>
                    <div>
                      <label className={label} htmlFor="coupon-until">Válido hasta <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <input id="coupon-until" type="date" value={draft.validUntil} min={draft.validFrom || undefined} onChange={e => set('validUntil', e.target.value)} className={field} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="coupon-max">Límite de usos <span className="text-gray-400 font-normal">(opcional)</span></label>
                      <input id="coupon-max" type="number" inputMode="numeric" min={1} step={1} value={draft.maxRedemptions} onChange={e => set('maxRedemptions', e.target.value)} className={field} placeholder="Ilimitado" />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 self-end">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.isActive}
                        aria-label="Cupón activo"
                        onClick={() => set('isActive', !draft.isActive)}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${draft.isActive ? 'bg-[#9B7E67]' : 'bg-gray-300'}`}
                      >
                        <motion.div className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" animate={{ left: draft.isActive ? '26px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                      </button>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">Cupón activo</p>
                        <p className="text-xs text-gray-500">Se puede usar en la web</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={label} htmlFor="coupon-description">Nota interna <span className="text-gray-400 font-normal">(opcional, solo la ves tú)</span></label>
                    <input id="coupon-description" type="text" value={draft.description} onChange={e => set('description', e.target.value)} maxLength={300} className={field} placeholder="Ej. Campaña de verano en Instagram" />
                  </div>

                  <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl p-4">
                    El descuento se aplica al total de la reserva (alojamiento y extras). El huésped ve el precio final antes de pagar y Stripe cobra ese importe.
                  </p>
                  {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-4">{formError}</p>}
                </form>
              </div>

              <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sm:rounded-b-2xl">
                <button type="button" onClick={() => setDraft(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" form="couponForm" disabled={saving} className="px-6 py-2.5 bg-[#2C2927] text-white font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {draft.id ? 'Guardar cambios' : 'Crear cupón'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AdminConfirmModal
        isOpen={Boolean(toDelete)}
        title="Eliminar cupón"
        description={`El código ${toDelete?.code ?? ''} dejará de funcionar. Las reservas que ya lo usaron no cambian.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
      <AdminToast isOpen={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} onClose={() => setToast(null)} />
      </SiteModulePortal>
    </div>
  );
}
