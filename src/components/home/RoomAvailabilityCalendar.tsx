'use client';
/**
 * Read-only availability for one lodging, straight from CALA
 * (`/api/availability` → site.lodging_availability). Nights are not
 * selectable and nothing reacts to hover: guests pick dates in the booking
 * flow. The number of months adapts to the panel width (1 on phones, tablets
 * and laptops; 2 when the panel is wide enough).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './room-availability.css';

type Range = { from: string; to: string };
type AvailabilityResponse = {
  disabledRanges?: Range[];
  propertySettings?: { today?: string; openThrough?: string | null; leadTimeDays?: number };
  error?: string;
};

const MONTHS_AHEAD = 12;
/** Content width (without the card padding) needed for two legible months. */
const TWO_MONTHS_MIN_WIDTH = 480;

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function RoomAvailabilityCalendar({ lodgingId, isEn }: { lodgingId: string; isEn: boolean }) {
  const locale = isEn ? 'en-US' : 'es-MX';
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [columns, setColumns] = useState(1);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The parent remounts this component per lodging (key), so no reset here.
    const controller = new AbortController();
    fetch('/api/availability/?' + new URLSearchParams({ lodgingId }), { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as AvailabilityResponse;
        if (!response.ok) throw new Error(body.error || 'error');
        setData(body);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(isEn ? "We couldn't load availability right now." : 'No pudimos cargar la disponibilidad en este momento.');
      });
    return () => controller.abort();
  }, [lodgingId, isEn]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setColumns(entry.contentRect.width >= TWO_MONTHS_MIN_WIDTH ? 2 : 1),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const today = useMemo(() => {
    const value = data?.propertySettings?.today;
    const date = value ? parse(value) : new Date(new Date().setHours(0, 0, 0, 0));
    return date;
  }, [data]);

  // Night-by-night: a day is unavailable when that night can't be booked.
  const isUnavailable = useMemo(() => {
    const blocked = new Set<string>();
    for (const range of data?.disabledRanges ?? []) {
      for (let d = parse(range.from), end = parse(range.to); d <= end; d.setDate(d.getDate() + 1)) blocked.add(key(d));
    }
    const firstBookable = new Date(today);
    firstBookable.setDate(firstBookable.getDate() + (data?.propertySettings?.leadTimeDays ?? 0));
    const openThrough = data?.propertySettings?.openThrough ? parse(data.propertySettings.openThrough) : null;
    return (day: Date) => day < firstBookable || (openThrough !== null && day > openThrough) || blocked.has(key(day));
  }, [data, today]);

  const maxOffset = MONTHS_AHEAD - columns;
  const months = Array.from({ length: columns }, (_, i) => new Date(today.getFullYear(), today.getMonth() + offset + i, 1));
  const weekdays = useMemo(() => {
    const monday = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(monday.getFullYear(), 0, 1 + i)),
    );
  }, [locale]);
  const monthTitle = (d: Date) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
  const dayLabel = (d: Date) => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

  return (
    <section className="ra" ref={root} aria-label={isEn ? 'Availability' : 'Disponibilidad'}>
      <div className="ra-head">
        <p className="ra-eyebrow">{isEn ? 'Availability' : 'Disponibilidad'}</p>
        <div className="ra-nav">
          <button
            type="button"
            className="ra-arrow"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0 || !data}
            aria-label={isEn ? 'Previous month' : 'Mes anterior'}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="ra-arrow"
            onClick={() => setOffset((o) => Math.min(maxOffset, o + 1))}
            disabled={offset >= maxOffset || !data}
            aria-label={isEn ? 'Next month' : 'Mes siguiente'}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="ra-message" role="alert">{error}</p>
      ) : (
        <div className="ra-months" data-columns={columns} aria-busy={!data}>
          {months.map((month) => {
            const lead = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
            const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
            return (
              <div className="ra-month" key={key(month)}>
                <p className="ra-caption" aria-live="polite">{monthTitle(month)}</p>
                <div className="ra-grid" role="list">
                  {weekdays.map((w, i) => (
                    <span className="ra-weekday" key={'w' + i} aria-hidden="true">{w}</span>
                  ))}
                  {Array.from({ length: lead }, (_, i) => (
                    <span className="ra-cell ra-empty" key={'e' + i} aria-hidden="true" />
                  ))}
                  {Array.from({ length }, (_, i) => {
                    const day = new Date(month.getFullYear(), month.getMonth(), i + 1);
                    const past = day < today;
                    const state = !data ? 'loading' : past ? 'past' : isUnavailable(day) ? 'unavailable' : 'available';
                    const status =
                      state === 'available' ? (isEn ? 'available' : 'disponible')
                      : state === 'unavailable' ? (isEn ? 'not available' : 'no disponible')
                      : state === 'past' ? (isEn ? 'past' : 'pasado') : '';
                    return (
                      <span
                        className={`ra-cell ra-${state}${key(day) === key(today) ? ' ra-today' : ''}`}
                        key={i}
                        role="listitem"
                        aria-label={status ? `${dayLabel(day)}: ${status}` : undefined}
                      >
                        {i + 1}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="ra-legend" aria-hidden="true">
        <span><i className="ra-swatch ra-swatch-available" />{isEn ? 'Available' : 'Disponible'}</span>
        <span><i className="ra-swatch ra-swatch-unavailable" />{isEn ? 'Not available' : 'No disponible'}</span>
      </div>
      <p className="ra-note">
        {isEn ? 'For reference only — choose your dates when you book.' : 'Solo para consulta: eliges tus fechas al reservar.'}
      </p>
    </section>
  );
}
