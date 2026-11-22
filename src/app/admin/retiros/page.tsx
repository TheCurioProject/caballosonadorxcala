'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Sparkles, ExternalLink, CalendarDays, Users, Lock, Ticket } from 'lucide-react';
import { CalaSpinner as Loader2 } from '@/cala/components/ui/cala-loader';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';
import { AdminToast } from '@/components/admin/AdminToast';
import { SiteModulePortal } from '@/components/admin/SiteModulePortal';
import { prepareImage } from '@/lib/prepareImage';
import { uiLocale } from '@/cala/lib/format';
import { retreatDates, retreatNights, retreatPrice, retreatRemaining, retreatTotal, type Retreat, type RetreatOffer } from '@/lib/retreats';

interface Booking {
  bookingId: number; retreatId: number; lodgingId: string; guests: number; guestName: string; guestEmail: string;
  guestPhone: string | null; status: string; totalPrice: number; paid: number; notes: string | null; createdAt: string;
}
interface Room { id: string; name: string; capacity: number }
type Report = { onSale: boolean; rooms: Array<{ lodgingId: string; state: 'open' | 'sold' | 'busy' | 'off' }> };
type Draft = {
  id?: number; title: string; summary: string; description: string; isActive: boolean;
  startsOn: string; endsOn: string; stock: string; price: string;
  instructorName: string; instructorBio: string;
  image: File | null; imagePreview: string | null; removeImage: boolean;
  instructorImage: File | null; instructorPreview: string | null; removeInstructorImage: boolean;
};
type BookingDraft = { bookingId: number; guestName: string; guestEmail: string; guestPhone: string; guests: number; notes: string };

const LIVE = ['PENDING', 'PAID', 'CONFIRMED', 'PAYMENT_REVIEW'];
const statusLabel: Record<string, [string, string]> = {
  PENDING: ['Pendiente de pago', 'bg-amber-100 text-amber-800'],
  PAID: ['Pagada', 'bg-green-100 text-green-700'],
  CONFIRMED: ['Pagada', 'bg-green-100 text-green-700'],
  PAYMENT_REVIEW: ['Pago por revisar', 'bg-orange-100 text-orange-800'],
  CANCELLED: ['Cancelada', 'bg-gray-100 text-gray-600'],
  EXPIRED: ['Pago no completado', 'bg-gray-100 text-gray-600'],
  FAILED: ['Pago fallido', 'bg-gray-100 text-gray-600'],
};
const field = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none';
const label = 'block text-sm font-medium text-gray-700 mb-2';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan' }).format(new Date());

const emptyDraft = (): Draft => ({
  title: '', summary: '', description: '', isActive: true, startsOn: '', endsOn: '', stock: '', price: '',
  instructorName: '', instructorBio: '', image: null, imagePreview: null, removeImage: false,
  instructorImage: null, instructorPreview: null, removeInstructorImage: false,
});
const draftOf = (r: Retreat): Draft => ({
  ...emptyDraft(), id: r.id, title: r.title.es, summary: r.summary.es, description: r.description.es, isActive: r.isActive,
  startsOn: r.startsOn ?? '', endsOn: r.endsOn ?? '', stock: r.stock ? String(r.stock) : '', price: r.priceMinor ? String(r.priceMinor / 100) : '',
  instructorName: r.instructorName ?? '', instructorBio: r.instructorBio.es, imagePreview: r.imageUrl, instructorPreview: r.instructorImageUrl,
});

function ImagePicker({ preview, onPick, onRemove, id }: { preview: string | null; onPick: (f: File) => void; onRemove: () => void; id: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-start gap-4">
      <label htmlFor={id} className="flex-1 w-full flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-gray-500">
        <ImageIcon size={22} className="mb-2" />
        <span className="text-sm">Haz clic para subir 1 imagen</span>
        <input id={id} type="file" className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      </label>
      {preview && (
        <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-gray-200 shadow-sm shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <button type="button" onClick={onRemove} aria-label="Quitar imagen" className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 hover:bg-white shadow-sm"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

export default function RetreatsAdmin() {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [offers, setOffers] = useState<RetreatOffer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Retreat | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [report, setReport] = useState<{ title: string; report: Report; startsOn: string; endsOn: string } | null>(null);
  const [listing, setListing] = useState<Retreat | null>(null);
  const [editBooking, setEditBooking] = useState<BookingDraft | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [toCancel, setToCancel] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/retreats', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReady(Boolean(data.ready));
      setRetreats(data.retreats);
      setOffers(data.offers);
      setBookings(data.bookings);
      setRooms(data.rooms);
    } catch {
      setToast({ message: 'No se pudieron cargar los retiros.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const roomName = (id: string) => rooms.find(r => r.id === id)?.name ?? 'Habitación';
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setFormError('');
    const anySales = draft.startsOn || draft.endsOn || draft.stock || draft.price;
    if (anySales && (!draft.startsOn || !draft.endsOn || !draft.stock || !draft.price)) {
      setFormError('Para vender el retiro completa las fechas, el cupo y el precio del retiro.');
      return;
    }
    if (draft.startsOn && draft.endsOn && draft.endsOn <= draft.startsOn) {
      setFormError('La fecha de salida debe ser posterior a la de llegada.');
      return;
    }
    setSaving(true);
    const form = new FormData();
    if (draft.id) form.append('id', String(draft.id));
    form.append('title', draft.title);
    form.append('summary', draft.summary);
    form.append('description', draft.description);
    form.append('isActive', String(draft.isActive));
    form.append('startsOn', draft.startsOn);
    form.append('endsOn', draft.endsOn);
    form.append('stock', draft.stock);
    form.append('price', draft.price);
    form.append('instructorName', draft.instructorName);
    form.append('instructorBio', draft.instructorBio);
    // Resized in the browser: Vercel rejects requests above 4.5 MB.
    if (draft.image) form.append('image', await prepareImage(draft.image));
    if (draft.removeImage) form.append('removeImage', 'true');
    if (draft.instructorImage) form.append('instructorImage', await prepareImage(draft.instructorImage, 1200));
    if (draft.removeInstructorImage) form.append('removeInstructorImage', 'true');
    try {
      const res = await fetch('/api/admin/retreats', { method: draft.id ? 'PUT' : 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || 'No se pudo guardar el retiro.');
        return;
      }
      const saved = draft;
      setDraft(null);
      await load();
      if (data.report && saved.startsOn) setReport({ title: saved.title, report: data.report, startsOn: saved.startsOn, endsOn: saved.endsOn });
      else setToast({ message: 'Retiro guardado.', type: 'success' });
    } catch {
      setFormError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/retreats?id=${toDelete.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setToast({ message: data.error || 'No se pudo eliminar el retiro.', type: 'error' });
      else {
        setToast({ message: 'Retiro eliminado. Sus fechas vuelven a estar libres en CALA.', type: 'success' });
        await load();
      }
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  async function saveBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!editBooking) return;
    setBookingBusy(true);
    setBookingError('');
    try {
      const res = await fetch('/api/admin/retreats/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editBooking, guestPhone: editBooking.guestPhone.trim() || null, notes: editBooking.notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setBookingError(data.error || 'No se pudo guardar la reserva.'); return; }
      setEditBooking(null);
      setToast({ message: 'Reserva actualizada. CALA ya muestra los cambios.', type: 'success' });
      await load();
    } finally {
      setBookingBusy(false);
    }
  }

  async function cancelBooking() {
    if (!toCancel) return;
    setBookingBusy(true);
    try {
      const res = await fetch('/api/admin/retreats/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', bookingId: toCancel.bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setToast({ message: data.error || 'No se pudo cancelar la reserva.', type: 'error' });
      else {
        setToast({ message: 'Reserva cancelada. La habitación vuelve a estar disponible para el retiro.', type: 'success' });
        await load();
      }
    } finally {
      setBookingBusy(false);
      setToCancel(null);
    }
  }

  // CALA's interface language (screens remount when it changes).
  const ui = uiLocale() === 'en-US' ? 'en' : 'es';
  const listed = listing ? bookings.filter(b => b.retreatId === listing.id) : [];
  const nights = draft ? retreatNights(draft.startsOn || null, draft.endsOn || null) : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap justify-between items-start lg:items-center mb-8 gap-4">
        {/* Text wraps first; the actions move below only when they no longer fit. */}
        <div className="flex-1 min-w-[16rem]">
          <h1 className="font-serif text-3xl text-[#2C2927]">Retiros</h1>
          <p className="text-gray-500 mt-1">Retiros que se venden en la web junto con una habitación (el hospedaje se cobra con las tarifas de CALA).</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
          <a href="/es/retiros/" target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 flex items-center gap-2 hover:bg-white transition-colors whitespace-nowrap">
            <ExternalLink size={16} /> Ver página de retiros
          </a>
          <button onClick={() => { setFormError(''); setDraft(emptyDraft()); }} className="bg-[#9B7E67] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#8A6D56] transition-colors whitespace-nowrap">
            <Plus size={18} /> Nuevo retiro
          </button>
        </div>
      </div>

      {!loading && !ready && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Falta activar la venta de retiros en la base de datos. Mientras tanto puedes editar los textos, pero no se pueden vender ni bloquear fechas.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-[#9B7E67]" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {retreats.map(r => {
            const offer = offers.find(o => o.id === r.id);
            const sold = offer?.sold ?? 0;
            const left = retreatRemaining(r, offer);
            const count = bookings.filter(b => b.retreatId === r.id && LIVE.includes(b.status)).length;
            const ended = Boolean(r.endsOn && r.endsOn <= today());
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-2xl border ${r.isActive && !ended ? 'border-gray-200 shadow-sm' : 'border-gray-200/50 opacity-75'} overflow-hidden flex flex-col`}>
                <div className="relative w-full h-44 bg-gray-100">
                  {r.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    : <div className="absolute inset-0 flex items-center justify-center text-gray-300"><ImageIcon size={36} /></div>}
                  <span className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${ended ? 'bg-gray-100 text-gray-600' : r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {ended ? 'Terminado' : r.isActive ? 'Visible' : 'Oculto'}
                  </span>
                </div>
                <div className="p-5 flex-grow flex flex-col gap-3">
                  <h3 className="font-serif text-xl font-bold text-[#2C2927] line-clamp-2" data-no-translate>{r.title.es}</h3>
                  {r.startsOn && r.endsOn ? (
                    <div className="space-y-1.5 text-sm text-gray-600">
                      <p className="flex items-center gap-2 flex-wrap"><CalendarDays size={15} className="text-[#9B7E67]" /><span data-no-translate>{retreatDates(r.startsOn, r.endsOn, ui)}</span><span>·</span><span>{retreatNights(r.startsOn, r.endsOn)} noches</span></p>
                      {r.priceMinor ? <p className="flex items-center gap-2"><Ticket size={15} className="text-[#9B7E67] shrink-0" /><span>{`Retiro ${retreatPrice(r.priceMinor, ui)} + hospedaje según CALA`}</span></p> : null}
                      <p className="flex items-center gap-2"><Users size={15} className="text-[#9B7E67]" /><span>{offer?.onSale ? `Vendidos ${sold} de ${r.stock ?? 0} · quedan ${left}` : `Vendidos ${sold} de ${r.stock ?? 0} · fuera de venta`}</span></p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sin fechas: no está a la venta ni bloquea el calendario.</p>
                  )}
                  <div className="flex justify-between items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
                    <button onClick={() => setListing(r)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                      {`Reservas (${count})`}
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => { setFormError(''); setDraft(draftOf(r)); }} title="Editar retiro" aria-label="Editar retiro" className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => setToDelete(r)} title="Eliminar retiro" aria-label="Eliminar retiro" className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {retreats.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <CalendarDays size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Aún no hay retiros.</p>
              <button onClick={() => setDraft(emptyDraft())} className="text-[#9B7E67] hover:underline mt-2">Crea el primer retiro</button>
            </div>
          )}
        </div>
      )}

      <SiteModulePortal>
        <AnimatePresence>
          {draft && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && setDraft(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 20 }}
                className="relative bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-[#F9F7F4]">
                  <h2 className="font-serif text-2xl text-[#2C2927]">{draft.id ? 'Editar retiro' : 'Nuevo retiro'}</h2>
                  <button onClick={() => setDraft(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
                </div>
                <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
                  <form id="retreatForm" onSubmit={save} className="space-y-6">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                      <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
                        <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" /> Traducción automática: escribe en un idioma y la web mostrará la versión en español y en inglés.
                      </p>
                    </div>
                    <div>
                      <label className={label} htmlFor="retreat-title">Título</label>
                      <input id="retreat-title" required value={draft.title} onChange={e => set('title', e.target.value)} className={field} />
                    </div>
                    <div>
                      <label className={label} htmlFor="retreat-summary">Resumen <span className="text-gray-400 font-normal">(1-2 líneas, se ve en la tarjeta)</span></label>
                      <textarea id="retreat-summary" rows={2} value={draft.summary} onChange={e => set('summary', e.target.value)} className={`${field} resize-none`} />
                    </div>
                    <div>
                      <label className={label} htmlFor="retreat-description">Descripción completa</label>
                      <textarea id="retreat-description" required rows={7} value={draft.description} onChange={e => set('description', e.target.value)} className={`${field} resize-none`} />
                    </div>
                    <div>
                      <span className={label}>Imagen principal (opcional)</span>
                      <ImagePicker id="retreat-image" preview={draft.imagePreview}
                        onPick={f => setDraft(d => d && ({ ...d, image: f, imagePreview: URL.createObjectURL(f), removeImage: false }))}
                        onRemove={() => setDraft(d => d && ({ ...d, image: null, imagePreview: null, removeImage: true }))} />
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <h3 className="text-lg font-serif text-[#2C2927]">Venta del retiro</h3>
                      <div className="rounded-xl border border-[#9B7E67]/25 bg-[#9B7E67]/5 p-4 text-sm text-[#5b4a3c] flex items-start gap-2">
                        <Lock size={16} className="shrink-0 mt-0.5 text-[#9B7E67]" />
                        <span>Al guardar, CALA bloquea todas las habitaciones de la casa en estas fechas: la web y las OTAs (Airbnb, Booking… por iCal) dejan de venderlas. Solo los clientes del retiro pueden reservarlas, cada uno con su habitación.</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={label} htmlFor="retreat-start">Llegada (inicio)</label>
                          <input id="retreat-start" type="date" min={draft.id ? undefined : today()} value={draft.startsOn} onChange={e => set('startsOn', e.target.value)} className={field} />
                        </div>
                        <div>
                          <label className={label} htmlFor="retreat-end">Salida (fin)</label>
                          <input id="retreat-end" type="date" min={draft.startsOn || undefined} value={draft.endsOn} onChange={e => set('endsOn', e.target.value)} className={field} />
                        </div>
                      </div>
                      {nights > 0 && <p className="text-sm text-gray-500 -mt-2">{`${nights} ${nights === 1 ? 'noche' : 'noches'}`}</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={label} htmlFor="retreat-stock">Cupo</label>
                          <input id="retreat-stock" type="number" inputMode="numeric" min={1} max={200} step={1} value={draft.stock} onChange={e => set('stock', e.target.value)} className={field} />
                          <p className="text-xs text-gray-500 mt-1.5">Cuántas veces se puede vender. Cada venta ocupa una habitación (1 o 2 personas). La web muestra sola «Solo N disponibles».</p>
                        </div>
                        <div>
                          <label className={label} htmlFor="retreat-price">Precio del retiro por reserva, sin hospedaje (MXN)</label>
                          <input id="retreat-price" type="number" inputMode="decimal" min={1} step="0.01" value={draft.price} onChange={e => set('price', e.target.value)} className={field} />
                          <p className="text-xs text-gray-500 mt-1.5">Escribe solo el precio del retiro, sin el hospedaje.</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 space-y-1.5">
                        <p className="font-medium">El hospedaje se suma automáticamente con las tarifas de CALA</p>
                        <p>Cuando el cliente elige su habitación, la web suma al precio del retiro el hospedaje de esa habitación para estas fechas, según «Tarifas y restricciones» de CALA (impuestos incluidos). No hay precios fijos por habitación: si cambias una tarifa en CALA, el total cambia solo.</p>
                      </div>
                      {draft.id && (() => {
                        const offer = offers.find(o => o.id === draft.id);
                        const priceMinor = Math.round(Number(draft.price) * 100);
                        const priced = (offer?.rooms ?? []).filter(r => r.lodgingMinor != null);
                        const sameDates = (retreats.find(r => r.id === draft.id)?.startsOn ?? '') === draft.startsOn && (retreats.find(r => r.id === draft.id)?.endsOn ?? '') === draft.endsOn;
                        if (!priced.length || !sameDates || !Number.isFinite(priceMinor) || priceMinor <= 0) return null;
                        return (
                          <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <p className="px-4 py-2.5 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">Lo que pagará el cliente según la habitación</p>
                            <ul className="divide-y divide-gray-100 text-sm">
                              {priced.map(r => (
                                <li key={r.lodgingId} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <span className="min-w-0 break-words font-medium text-gray-800" data-no-translate>{roomName(r.lodgingId)}</span>
                                  <span className="text-gray-600 sm:text-right">
                                    <span>{`Retiro ${retreatPrice(priceMinor, ui)} + hospedaje ${retreatPrice(r.lodgingMinor ?? 0, ui)} = `}</span>
                                    <strong className="text-gray-900">{retreatPrice(retreatTotal(priceMinor, r.lodgingMinor), ui)}</strong>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <h3 className="text-lg font-serif text-[#2C2927]">Instructor (opcional)</h3>
                      <div>
                        <label className={label} htmlFor="retreat-instructor">Nombre del instructor</label>
                        <input id="retreat-instructor" value={draft.instructorName} onChange={e => set('instructorName', e.target.value)} className={field} />
                      </div>
                      <div>
                        <label className={label} htmlFor="retreat-bio">Biografía del instructor</label>
                        <textarea id="retreat-bio" rows={4} value={draft.instructorBio} onChange={e => set('instructorBio', e.target.value)} className={`${field} resize-none`} />
                      </div>
                      <div>
                        <span className={label}>Foto del instructor</span>
                        <ImagePicker id="retreat-instructor-image" preview={draft.instructorPreview}
                          onPick={f => setDraft(d => d && ({ ...d, instructorImage: f, instructorPreview: URL.createObjectURL(f), removeInstructorImage: false }))}
                          onRemove={() => setDraft(d => d && ({ ...d, instructorImage: null, instructorPreview: null, removeInstructorImage: true }))} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <button type="button" role="switch" aria-checked={draft.isActive} aria-label="Visible en la web" onClick={() => set('isActive', !draft.isActive)}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${draft.isActive ? 'bg-[#9B7E67]' : 'bg-gray-300'}`}>
                        <motion.div className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" animate={{ left: draft.isActive ? '26px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                      </button>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">Visible en la web</p>
                        <p className="text-xs text-gray-500">Si lo ocultas deja de venderse y CALA libera las habitaciones que no se han vendido.</p>
                      </div>
                    </div>
                    {formError && <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{formError}</p>}
                  </form>
                </div>
                <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                  <button type="button" onClick={() => setDraft(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
                  <button type="submit" form="retreatForm" disabled={saving} className="px-6 py-2.5 bg-[#2C2927] text-white font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {draft.id ? 'Guardar cambios' : 'Crear retiro'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {report && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReport(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
                <h2 className="font-serif text-2xl text-[#2C2927]">Retiro guardado</h2>
                {report.report.onSale ? (
                  <>
                    <p className="text-gray-600 text-sm">
                      {`Del ${retreatDates(report.startsOn, report.endsOn, ui)} las habitaciones quedan cerradas para el público y para las OTAs. Solo se venden con el retiro.`}
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {report.report.rooms.map(r => (
                        <li key={r.lodgingId} className="flex justify-between gap-3">
                          <span data-no-translate>{roomName(r.lodgingId)}</span>
                          <span className={r.state === 'busy' ? 'text-amber-700 font-medium' : r.state === 'sold' ? 'text-green-700' : 'text-gray-500'}>
                            {r.state === 'open' ? 'Bloqueada para el retiro' : r.state === 'sold' ? 'Vendida en el retiro' : r.state === 'busy' ? 'Ya ocupada: no se ofrece' : 'Libre'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {report.report.rooms.some(r => r.state === 'busy') && (
                      <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">Las habitaciones que ya tenían una reserva o un bloqueo en esas fechas no se ofrecen en el retiro. Si se liberan, vuelve a guardar el retiro para incluirlas.</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-600 text-sm">El retiro no está a la venta (oculto o terminado): CALA no bloquea sus fechas.</p>
                )}
                <div className="flex justify-end"><button onClick={() => setReport(null)} className="px-5 py-2.5 bg-[#2C2927] text-white rounded-lg">Entendido</button></div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {listing && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-0 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !bookingBusy && (setListing(null), setEditBooking(null))} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                className="relative bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-start gap-4 bg-[#F9F7F4]">
                  <div className="min-w-0">
                    <h2 className="font-serif text-2xl text-[#2C2927]">Reservas del retiro</h2>
                    <p className="text-sm text-gray-500 truncate" data-no-translate>{listing.title.es}</p>
                  </div>
                  <button onClick={() => { setListing(null); setEditBooking(null); }} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700 shrink-0"><X size={24} /></button>
                </div>
                <div className="p-5 sm:p-6 overflow-y-auto flex-grow space-y-3">
                  <p className="text-xs text-gray-500">Cada reserva es también una reserva de CALA (código WEB-número) en su habitación. Los cambios que hagas aquí se ven en CALA al momento.</p>
                  {listed.length === 0 && <p className="text-gray-500 py-8 text-center">Todavía no hay reservas.</p>}
                  {listed.map(b => {
                    const [text, tone] = statusLabel[b.status] ?? [b.status, 'bg-gray-100 text-gray-600'];
                    const editing = editBooking?.bookingId === b.bookingId;
                    return (
                      <div key={b.bookingId} className="rounded-xl border border-gray-200 p-4">
                        {editing && editBooking ? (
                          <form onSubmit={saveBooking} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <input aria-label="Nombre" value={editBooking.guestName} onChange={e => setEditBooking({ ...editBooking, guestName: e.target.value })} className={field} placeholder="Nombre" />
                              <input aria-label="Correo" type="email" value={editBooking.guestEmail} onChange={e => setEditBooking({ ...editBooking, guestEmail: e.target.value })} className={field} placeholder="Correo" />
                              <input aria-label="Teléfono" value={editBooking.guestPhone} onChange={e => setEditBooking({ ...editBooking, guestPhone: e.target.value })} className={field} placeholder="Teléfono" />
                              <select aria-label="Personas" value={editBooking.guests} onChange={e => setEditBooking({ ...editBooking, guests: Number(e.target.value) })} className={field}>
                                <option value={1}>1 persona</option>
                                <option value={2}>2 personas</option>
                              </select>
                            </div>
                            <textarea aria-label="Notas" rows={3} value={editBooking.notes} onChange={e => setEditBooking({ ...editBooking, notes: e.target.value })} className={`${field} resize-none text-sm`} />
                            {bookingError && <p role="alert" className="text-sm text-red-700">{bookingError}</p>}
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditBooking(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                              <button type="submit" disabled={bookingBusy} className="px-4 py-2 bg-[#2C2927] text-white rounded-lg disabled:opacity-60">Guardar</button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-medium text-[#2C2927] break-words" data-no-translate>{b.guestName} <span className="text-gray-400 font-normal">· WEB-{b.bookingId}</span></p>
                              <p className="text-sm text-gray-500 break-all" data-no-translate>{b.guestEmail}{b.guestPhone ? ` · ${b.guestPhone}` : ''}</p>
                              <p className="text-sm text-gray-600"><span data-no-translate>{roomName(b.lodgingId)}</span> · <span>{`${b.guests} ${b.guests === 1 ? 'persona' : 'personas'}`}</span></p>
                              <p className="text-sm text-gray-600"><span>{retreatPrice(Math.round(b.totalPrice * 100), ui)}</span>{b.paid > 0 && <> · <span>{`pagado ${retreatPrice(Math.round(b.paid * 100), ui)}`}</span></>}</p>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${tone}`}>{text}</span>
                              {LIVE.includes(b.status) && (
                                <div className="flex gap-1">
                                  <button onClick={() => { setBookingError(''); setEditBooking({ bookingId: b.bookingId, guestName: b.guestName, guestEmail: b.guestEmail, guestPhone: b.guestPhone ?? '', guests: b.guests, notes: b.notes ?? '' }); }}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Editar</button>
                                  <button onClick={() => setToCancel(b)} className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Cancelar</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </SiteModulePortal>

      <AdminConfirmModal
        isOpen={Boolean(toDelete)}
        title="¿Eliminar este retiro?"
        description="Se quita de la web y CALA libera sus fechas. Si tiene reservas vigentes, primero cancélalas."
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
      <AdminConfirmModal
        isOpen={Boolean(toCancel)}
        title="¿Cancelar esta reserva del retiro?"
        description={toCancel && toCancel.paid > 0
          ? 'CALA cancelará la reserva y la habitación volverá a estar disponible para el retiro. El reembolso del pago se hace aparte en Stripe.'
          : 'CALA cancelará la reserva y la habitación volverá a estar disponible para el retiro.'}
        confirmText="Cancelar reserva"
        cancelText="Volver"
        variant="danger"
        isLoading={bookingBusy}
        onConfirm={() => void cancelBooking()}
        onCancel={() => setToCancel(null)}
      />
      <AdminToast isOpen={Boolean(toast)} message={toast?.message ?? ''} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  );
}
