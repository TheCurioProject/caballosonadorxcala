'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Image as ImageIcon, Compass, Sparkles, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react';
import { CalaSpinner as Loader2 } from '@/cala/components/ui/cala-loader';
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal';
import { AdminToast } from '@/components/admin/AdminToast';
import { SiteModulePortal } from '@/components/admin/SiteModulePortal';

type Lang = 'es' | 'en';
type Pair = { es: string; en: string };
interface Tour {
  id: number;
  title: Pair;
  summary: Pair;
  long: Pair;
  duration: Pair;
  capacity: Pair;
  includes: { es: string[]; en: string[] };
  images: string[];
  pricePerPax: number;
  isActive: boolean;
  sortOrder: number;
  bookingName: string;
}
type Draft = {
  id?: number;
  title: Pair;
  summary: Pair;
  long: Pair;
  duration: Pair;
  capacity: Pair;
  includes: Pair; // one item per line while editing
  images: string[];
  price: string;
  isActive: boolean;
};

const emptyPair = (): Pair => ({ es: '', en: '' });
const emptyDraft = (): Draft => ({
  title: emptyPair(), summary: emptyPair(), long: emptyPair(), duration: emptyPair(), capacity: emptyPair(),
  includes: emptyPair(), images: [], price: '', isActive: true,
});
const draftOf = (t: Tour): Draft => ({
  id: t.id, title: { ...t.title }, summary: { ...t.summary }, long: { ...t.long }, duration: { ...t.duration }, capacity: { ...t.capacity },
  includes: { es: t.includes.es.join('\n'), en: t.includes.en.join('\n') }, images: [...t.images], price: String(t.pricePerPax), isActive: t.isActive,
});
const linesOf = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);
const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')} MXN`;
/** Small Cloudinary rendition for lists (the stored URL is the full image). */
const thumb = (url: string, width = 640) => url.includes('/image/upload/') ? url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_fill,w_${width}/`) : url;
const legacyName = (raw: string) => {
  try { const p = JSON.parse(raw); return String(p.es || p.original || p.en || raw); } catch { return raw; }
};

/** Photos are resized in the browser so uploads stay small and fast. */
async function prepareImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.86));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }) : file;
  } catch {
    return file;
  }
}

const field = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#9B7E67]/20 focus:border-[#9B7E67] transition-all outline-none';
const label = 'block text-sm font-medium text-gray-700 mb-2';

export default function AtvToursAdmin() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lang, setLang] = useState<Lang>('es');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState<Tour | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tours/', { cache: 'no-store' });
      if (res.status === 503) { setPending(true); return; }
      const data = await res.json();
      if (Array.isArray(data)) setTours(data);
    } catch {
      setToast({ message: 'No pudimos cargar los tours. Recarga la página.', type: 'error' });
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

  const open = (tour?: Tour) => { setDraft(tour ? draftOf(tour) : emptyDraft()); setLang('es'); setFormError(''); };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => (d ? { ...d, [key]: value } : d));
  const setText = (key: 'title' | 'summary' | 'long' | 'duration' | 'capacity' | 'includes', value: string) =>
    setDraft(d => (d ? { ...d, [key]: { ...d[key], [lang]: value } } : d));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setFormError('');
    const picked = Array.from(files).slice(0, 24);
    setUploading(n => n + picked.length);
    for (const original of picked) {
      try {
        const body = new FormData();
        body.append('file', await prepareImage(original));
        const res = await fetch('/api/admin/tours/upload/', { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo subir la imagen.');
        setDraft(d => (d && d.images.length < 24 ? { ...d, images: [...d.images, data.url] } : d));
      } catch (error) {
        setFormError((error as Error).message);
      } finally {
        setUploading(n => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  };
  const moveImage = (index: number, delta: number) => setDraft(d => {
    if (!d) return d;
    const target = index + delta;
    if (target < 0 || target >= d.images.length) return d;
    const images = [...d.images];
    [images[index], images[target]] = [images[target], images[index]];
    return { ...d, images };
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const price = Number(draft.price);
    if (!draft.title.es.trim() && !draft.title.en.trim()) return setFormError('Escribe el nombre del tour.');
    if (!Number.isFinite(price) || price < 0) return setFormError('Escribe un precio por persona válido.');
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch('/api/admin/tours/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(draft.id ? { id: draft.id } : {}),
          title: draft.title, summary: draft.summary, long: draft.long, duration: draft.duration, capacity: draft.capacity,
          includes: { es: linesOf(draft.includes.es), en: linesOf(draft.includes.en) },
          images: draft.images, pricePerPax: price, isActive: draft.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el tour.');
      setDraft(null);
      setToast({ message: draft.id ? 'Tour actualizado. Ya se ve en la página de tours.' : 'Tour creado. Ya se ve en la página de tours.', type: 'success' });
      await load();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/tours/?id=${toDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setToast({ message: 'Tour eliminado de la página de tours.', type: 'success' });
      setToDelete(null);
      await load();
    } catch {
      setToast({ message: 'No se pudo eliminar el tour.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const reorder = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= tours.length) return;
    const next = [...tours];
    [next[index], next[target]] = [next[target], next[index]];
    setTours(next);
    try {
      const res = await fetch('/api/admin/tours/', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map(t => t.id) }) });
      if (!res.ok) throw new Error();
    } catch {
      setToast({ message: 'No se pudo guardar el orden.', type: 'error' });
      void load();
    }
  };

  const other: Lang = lang === 'es' ? 'en' : 'es';
  const langName = (l: Lang) => (l === 'es' ? 'Español' : 'English');

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="font-serif text-3xl text-[#2C2927]">ATV Tours</h1>
          <p className="text-gray-500 mt-1">Los tours que se muestran en la página pública de tours y en el modal de reservas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/es/tours/" target="_blank" rel="noreferrer" className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 flex items-center gap-2 hover:bg-white transition-colors whitespace-nowrap">
            <ExternalLink size={16} />
            Ver página de tours
          </a>
          {!pending && (
            <button onClick={() => open()} className="bg-[#9B7E67] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#8A6D56] transition-colors whitespace-nowrap">
              <Plus size={18} />
              Nuevo tour
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin text-[#9B7E67]" size={32} />
        </div>
      ) : pending ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Compass size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 font-medium">Falta activar esta sección en la base de datos.</p>
          <p className="text-gray-500 text-sm mt-1">Mientras tanto, la página de tours sigue mostrando su contenido actual.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tours.map((tour, index) => (
            <motion.div
              key={tour.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border ${tour.isActive ? 'border-gray-200 shadow-sm' : 'border-gray-200/50 opacity-70'} overflow-hidden flex flex-col`}
            >
              <div className="relative w-full h-48 bg-gray-100">
                {tour.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(tour.images[0])} alt={tour.title.es} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300"><ImageIcon size={36} /></div>
                )}
                <span className="absolute top-3 left-3 bg-black/55 text-white text-xs font-bold tracking-widest px-2.5 py-1 rounded-full" data-no-translate>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="absolute bottom-3 right-3 bg-black/55 text-white text-xs px-2.5 py-1 rounded-full">
                  {tour.images.length} {tour.images.length === 1 ? 'foto' : 'fotos'}
                </span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h3 className="font-serif text-xl font-bold text-[#2C2927] line-clamp-2" data-no-translate>{tour.title.es || tour.title.en}</h3>
                  <div className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tour.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tour.isActive ? 'Visible' : 'Oculto'}
                  </div>
                </div>
                <p className="text-gray-500 text-sm line-clamp-3 mb-4 flex-grow" data-no-translate>{tour.summary.es || tour.summary.en}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#9B7E67] font-medium mb-4">
                  <span data-no-translate>{money(tour.pricePerPax)}</span>
                  <span className="text-gray-400">por persona</span>
                  {tour.duration.es && <span className="flex items-center gap-1 text-gray-500" data-no-translate><Clock size={14} />{tour.duration.es}</span>}
                </div>
                <div className="flex justify-between items-center gap-3 pt-4 border-t border-gray-100 mt-auto">
                  <div className="flex gap-1">
                    <button onClick={() => void reorder(index, -1)} disabled={index === 0} title="Subir en la página" aria-label="Subir en la página" className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-30">
                      <ChevronUp size={18} />
                    </button>
                    <button onClick={() => void reorder(index, 1)} disabled={index === tours.length - 1} title="Bajar en la página" aria-label="Bajar en la página" className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-30">
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => open(tour)} title="Editar tour" aria-label="Editar tour" className="p-2 text-gray-500 hover:text-[#9B7E67] hover:bg-orange-50 rounded-lg transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => setToDelete(tour)} title="Eliminar tour" aria-label="Eliminar tour" className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {tours.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <Compass size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Aún no hay tours.</p>
              <button onClick={() => open()} className="text-[#9B7E67] hover:underline mt-2">Crea el primer tour</button>
            </div>
          )}
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
              className="relative bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-[#F9F7F4]">
                <h2 className="font-serif text-2xl text-[#2C2927]">{draft.id ? 'Editar tour' : 'Nuevo tour'}</h2>
                <button onClick={() => setDraft(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
                <form id="tourForm" onSubmit={save} className="space-y-6">
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm text-blue-800 font-medium flex items-start gap-2">
                      <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <span>Escribe en español, en inglés o en ambos. Lo que dejes vacío en un idioma se traduce solo al guardar.</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2" role="tablist" aria-label="Idioma del texto">
                    {(['es', 'en'] as Lang[]).map(l => (
                      <button
                        key={l}
                        type="button"
                        role="tab"
                        aria-selected={lang === l}
                        onClick={() => setLang(l)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${lang === l ? 'bg-[#2C2927] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        data-no-translate
                      >
                        {langName(l)}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className={label} htmlFor="tour-title">Nombre del tour</label>
                    <input id="tour-title" type="text" value={draft.title[lang]} onChange={e => setText('title', e.target.value)} maxLength={120} className={field} placeholder={draft.title[other] || 'Ej. Ojo de Agua'} />
                  </div>
                  <div>
                    <label className={label} htmlFor="tour-summary">Descripción corta <span className="text-gray-400 font-normal">(1-2 líneas, se ve en la lista)</span></label>
                    <textarea id="tour-summary" rows={2} value={draft.summary[lang]} onChange={e => setText('summary', e.target.value)} maxLength={400} className={`${field} resize-none`} placeholder={draft.summary[other] || 'Una frase que invite a conocer el recorrido…'} />
                  </div>
                  <div>
                    <label className={label} htmlFor="tour-long">Acerca del recorrido <span className="text-gray-400 font-normal">(se ve al abrir el tour)</span></label>
                    <textarea id="tour-long" rows={7} value={draft.long[lang]} onChange={e => setText('long', e.target.value)} maxLength={4000} className={`${field} resize-none`} placeholder={draft.long[other] || 'Cuenta el recorrido completo…'} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="tour-duration">Duración</label>
                      <input id="tour-duration" type="text" value={draft.duration[lang]} onChange={e => setText('duration', e.target.value)} maxLength={60} className={field} placeholder={draft.duration[other] || 'Ej. 3-4 hrs'} />
                    </div>
                    <div>
                      <label className={label} htmlFor="tour-capacity">Capacidad</label>
                      <input id="tour-capacity" type="text" value={draft.capacity[lang]} onChange={e => setText('capacity', e.target.value)} maxLength={160} className={field} placeholder={draft.capacity[other] || 'Ej. Máximo 5 pasajeros por unidad'} />
                    </div>
                  </div>
                  <div>
                    <label className={label} htmlFor="tour-includes">Qué incluye <span className="text-gray-400 font-normal">(un elemento por línea)</span></label>
                    <textarea id="tour-includes" rows={4} value={draft.includes[lang]} onChange={e => setText('includes', e.target.value)} className={`${field} resize-none`} placeholder={draft.includes[other] || 'Hielera con agua y hielo\nGuía/Conductor'} />
                  </div>

                  <div className="pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={label} htmlFor="tour-price">Precio por persona (MXN)</label>
                      <input id="tour-price" type="number" inputMode="decimal" min={0} step="1" value={draft.price} onChange={e => set('price', e.target.value)} className={field} placeholder="1000" />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 self-end">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.isActive}
                        aria-label="Visible en la web"
                        onClick={() => set('isActive', !draft.isActive)}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${draft.isActive ? 'bg-[#9B7E67]' : 'bg-gray-300'}`}
                      >
                        <motion.div className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm" animate={{ left: draft.isActive ? '26px' : '2px' }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                      </button>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">Visible en la web</p>
                        <p className="text-xs text-gray-500">Aparece en la página de tours y se puede reservar</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <label className={label}>Fotos del tour <span className="text-gray-400 font-normal">(la primera es la portada)</span></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {draft.images.map((url, index) => (
                        <div key={url} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 shadow-sm group bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb(url, 400)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          {index === 0 && <span className="absolute top-1.5 left-1.5 bg-[#9B7E67] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Portada</span>}
                          <button type="button" onClick={() => set('images', draft.images.filter((_, i) => i !== index))} aria-label="Quitar foto" title="Quitar foto" className="absolute top-1.5 right-1.5 bg-white/90 p-1 rounded-full text-red-500 hover:bg-white shadow-sm">
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between">
                            <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label="Mover antes" title="Mover antes" className="bg-white/90 p-1 rounded-full text-gray-700 hover:bg-white shadow-sm disabled:opacity-0">
                              <ChevronLeft size={14} />
                            </button>
                            <button type="button" onClick={() => moveImage(index, 1)} disabled={index === draft.images.length - 1} aria-label="Mover después" title="Mover después" className="bg-white/90 p-1 rounded-full text-gray-700 hover:bg-white shadow-sm disabled:opacity-0">
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {draft.images.length < 24 && (
                        <label className="flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-gray-500 text-center px-2">
                          {uploading > 0 ? <Loader2 size={22} className="animate-spin mb-2 text-[#9B7E67]" /> : <ImageIcon size={22} className="mb-2" />}
                          <span className="text-sm">{uploading > 0 ? 'Subiendo…' : 'Añadir fotos'}</span>
                          <input ref={fileInput} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif" multiple disabled={uploading > 0} onChange={e => void upload(e.target.files)} />
                        </label>
                      )}
                    </div>
                  </div>

                  {draft.id && legacyName(tours.find(t => t.id === draft.id)?.bookingName ?? '') !== (tours.find(t => t.id === draft.id)?.title.es ?? '') && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4">
                      En el modal de reservas este tour todavía aparece como «<span data-no-translate>{legacyName(tours.find(t => t.id === draft.id)?.bookingName ?? '')}</span>». Al guardar se usará el nombre de arriba en todos lados.
                    </p>
                  )}
                  {formError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-4">{formError}</p>}
                </form>
              </div>

              <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sm:rounded-b-2xl">
                <button type="button" onClick={() => setDraft(null)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" form="tourForm" disabled={saving || uploading > 0} className="px-6 py-2.5 bg-[#2C2927] text-white font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {draft.id ? 'Guardar cambios' : 'Crear tour'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AdminConfirmModal
        isOpen={Boolean(toDelete)}
        title="Eliminar tour"
        description={`«${toDelete?.title.es || toDelete?.title.en || ''}» dejará de mostrarse en la página de tours y ya no se podrá reservar. Las reservas anteriores conservan su información.`}
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
