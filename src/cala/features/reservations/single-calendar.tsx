"use client";
import { useId, useRef, useState, type CSSProperties } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import type { Reservation, Unit } from "@/cala/domain/model";
import { addDays } from "@/cala/domain/shared/dates";
import {
  dayDistance,
  monthGrid,
  monthStart,
  shiftMonth,
  unitOccupancy,
} from "@/cala/domain/calendar/layout";
import { priceStay } from "@/cala/domain/reservations/pricing";
import { Icon } from "@/cala/components/ui/primitives";
import { money, shortDate, statusLabels, uiLocale } from "@/cala/lib/format";
import { guestName } from "./components";
import type { CalendarRange } from "./calendar-actions";
import { calendarRows, haptic, monthDays, monthLabel } from "./calendar-shared";

type Selection = { start: string; end: string | null };

/**
 * Airbnb-style single-unit calendar: one listing, nightly prices in each day,
 * tap check-in → tap check-out, and a side panel (bottom sheet on phones) with
 * the smart actions for the chosen nights.
 */
export function SingleCalendar({
  month,
  onMonth,
  units,
  reservations,
  compact = false,
  flash = null,
  onRange,
  onPreview,
  onBlock,
}: {
  month: string;
  onMonth: (month: string) => void;
  units: Unit[];
  /** Visible stays (already filtered by channel). */
  reservations: Reservation[];
  compact?: boolean;
  flash?: string | null;
  onRange: (range: CalendarRange) => void;
  onPreview: (reservation: Reservation) => void;
  onBlock: (id: string) => void;
}) {
  const fieldId = useId();
  const { data, can, command } = useWorkspace();
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [sel, setSel] = useState<Selection | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slide, setSlide] = useState<"next" | "prev" | "">("");
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState("");
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  const unit = units.find((u) => u.id === unitId) ?? units[0];
  if (!unit)
    return (
      <div className="panel padded sc-empty">
        <h3>Sin unidades para esta vista</h3>
        <p className="muted">Revisa los filtros o configura el inventario.</p>
      </div>
    );
  const type = data.inventoryTypes.find((t) => t.id === unit.inventoryTypeId);
  const plan = data.ratePlans.find(
    (p) => p.propertyId === unit.propertyId && p.active,
  );
  const property = data.properties.find((p) => p.id === unit.propertyId);
  const currency = property?.currency ?? "MXN";
  const rate = (day: string) => {
    const d = data.rateDays.find(
      (x) =>
        x.inventoryTypeId === unit.inventoryTypeId &&
        x.ratePlanId === plan?.id &&
        x.date === day,
    );
    return {
      amount: d?.amountMinor ?? type?.baseRateMinor ?? 0,
      closed: d?.closed ?? false,
      minStay: d?.minStay ?? 1,
      maxStay: d?.maxStay ?? 730,
      version: d?.version ?? 0,
    };
  };
  // Day cells are narrow (≈38px on a 320px phone): whole amounts with the
  // narrow symbol, and 10k+ in compact notation, so the price never clips.
  const cellPrice = (minor: number) =>
    new Intl.NumberFormat(uiLocale(), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      notation: minor >= 1_000_000 ? "compact" : "standard",
    }).format(minor / 100);
  const occupancyOf = (day: string) =>
    unitOccupancy(data, unit.id, day, addDays(day, 1));
  const heldNight = (day: string) => {
    const o = occupancyOf(day);
    return (
      o.reservations.length > 0 ||
      o.blocks.length > 0 ||
      data.analyticsComplete === false
    );
  };
  const writable = can("reservation.write") || can("inventory.write");
  const months = compact ? [monthStart(month)] : [monthStart(month), shiftMonth(month, 1)];

  // ---- selection ---------------------------------------------------------
  function pick(day: string) {
    if (day < data.today) return;
    if (!sel || sel.end) {
      if (heldNight(day)) return;
      setSel({ start: day, end: null });
      setNotice(null);
      haptic(10);
      return;
    }
    if (day <= sel.start) {
      if (heldNight(day)) return;
      setSel({ start: day, end: null });
      return;
    }
    for (let d = sel.start; d < day; d = addDays(d, 1))
      if (heldNight(d)) {
        setShake(day);
        window.setTimeout(() => setShake(null), 450);
        setNotice(
          `El rango cruza una fecha ocupada (${shortDate(d)}). Elige una salida anterior.`,
        );
        haptic([30, 40, 30]);
        return;
      }
    setSel({ start: sel.start, end: day });
    setNotice(null);
    haptic([8, 30, 8]);
    const nightsSelected = dayDistance(sel.start, day);
    const avg = Math.round(
      Array.from({ length: nightsSelected }, (_, i) =>
        rate(addDays(sel.start, i)),
      ).reduce((s, r) => s + r.amount, 0) / nightsSelected,
    );
    setPrice(String(avg / 100));
    setMinStay(String(rate(sel.start).minStay));
    setClosed(rate(sel.start).closed);
  }
  const previewEnd =
    sel && !sel.end && hover && hover > sel.start ? hover : sel?.end ?? null;
  const inRange = (day: string) =>
    Boolean(sel && previewEnd && day >= sel.start && day < previewEnd);

  // ---- insights ----------------------------------------------------------
  const days = monthDays(month);
  let booked = 0,
    blocked = 0,
    revenue = 0,
    published = 0;
  for (const day of days) {
    const o = occupancyOf(day);
    if (o.reservations.length) booked++;
    else if (o.blocks.length) blocked++;
    published += rate(day).amount;
    for (const r of o.reservations.filter((x) => x.unitId === unit.id))
      revenue += r.totalMinor / Math.max(1, dayDistance(r.arrival, r.departure));
  }
  const occupancyPct = Math.round((booked / days.length) * 100);
  const nextArrival = reservations
    .filter((r) => r.unitId === unit.id && r.arrival >= data.today)
    .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
  // Orphan nights: 1–2 free nights squeezed between occupied nights.
  const gaps: { start: string; end: string }[] = [];
  {
    let d = days[0] < data.today ? data.today : days[0];
    const stop = addDays(days[days.length - 1], 1);
    while (d < stop && gaps.length < 3) {
      if (!heldNight(d) && heldNight(addDays(d, -1))) {
        let e = d;
        while (e < stop && !heldNight(e) && dayDistance(d, e) < 3)
          e = addDays(e, 1);
        if (dayDistance(d, e) <= 2 && e < stop && heldNight(e))
          gaps.push({ start: d, end: e });
        d = e;
      } else d = addDays(d, 1);
    }
  }

  // ---- selection details -------------------------------------------------
  const complete = sel?.end ? { arrival: sel.start, departure: sel.end } : null;
  let quote: { total: number; error: string } | null = null;
  if (complete && plan)
    try {
      quote = {
        total: priceStay(
          data,
          unit.propertyId,
          unit.inventoryTypeId,
          plan.id,
          complete.arrival,
          complete.departure,
        ).totalMinor,
        error: "",
      };
    } catch (e) {
      quote = {
        total: 0,
        error: e instanceof Error ? e.message : "No se puede tarifar.",
      };
    }
  const nightCount = complete
    ? dayDistance(complete.arrival, complete.departure)
    : 0;

  async function applyRates() {
    if (!complete || !plan) return;
    setBusy(true);
    try {
      const expectedVersions: Record<string, number> = {};
      for (let d = complete.arrival; d < complete.departure; d = addDays(d, 1))
        expectedVersions[d] = rate(d).version;
      await command({
        type: "rates.bulk",
        ratePlanId: plan.id,
        inventoryTypeId: unit.inventoryTypeId,
        arrival: complete.arrival,
        departure: complete.departure,
        amountMinor: Math.round(Number(price) * 100),
        minStay: Math.max(1, Number(minStay) || 1),
        maxStay: Math.max(Number(minStay) || 1, rate(complete.arrival).maxStay),
        closed,
        cta: false,
        ctd: false,
        expectedVersions,
      });
      haptic([8, 30, 8]);
    } catch {
      /* the workspace toast already explains the error */
    } finally {
      setBusy(false);
    }
  }

  function swipeEnd(x: number, y: number) {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = x - s.x,
      dy = y - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) go(dx < 0 ? 1 : -1);
  }
  function go(delta: number) {
    setSlide(delta > 0 ? "next" : "prev");
    onMonth(shiftMonth(month, delta));
  }

  const panel = (
    <aside
      className={`sc-panel${compact && sel ? " is-sheet" : ""}`}
      aria-label="Detalles de las fechas"
    >
      {sel ? (
        <div className="sc-panel-inner" key={`${sel.start}-${sel.end}`}>
          <div className="row between">
            <p className="eyebrow">
              {complete ? "FECHAS SELECCIONADAS" : "ELIGE LA SALIDA"}
            </p>
            <button
              type="button"
              className="icon-button"
              aria-label="Limpiar selección"
              onClick={() => setSel(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <h3 className="sc-dates">
            {shortDate(sel.start)}
            <span aria-hidden="true">→</span>
            {complete ? shortDate(complete.departure) : "…"}
          </h3>
          <p className="muted">
            {unit.name}
            {complete
              ? ` · ${nightCount} ${nightCount === 1 ? "noche" : "noches"}`
              : " · toca el día de salida en el calendario"}
          </p>
          {complete && (
            <>
              {quote && !quote.error && can("finance.read") && (
                <dl className="sc-quote">
                  <div>
                    <dt>Total estimado</dt>
                    <dd>{money(quote.total, currency)}</dd>
                  </div>
                  <div>
                    <dt>Promedio por noche</dt>
                    <dd>
                      {money(Math.round(quote.total / nightCount), currency)}
                    </dd>
                  </div>
                </dl>
              )}
              {quote?.error && (
                <p className="notice warning">{quote.error}</p>
              )}
              {writable && data.analyticsComplete !== false && (
                <div className="sc-actions">
                  {can("reservation.write") && (
                    <button
                      type="button"
                      className="button primary"
                      onClick={() =>
                        onRange({
                          unitId: unit.id,
                          ...complete,
                          intent: "reservation",
                        })
                      }
                    >
                      <Icon name="plus" size={16} />
                      Crear reserva
                    </button>
                  )}
                  {can("inventory.write") && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        onRange({ unitId: unit.id, ...complete, intent: "block" })
                      }
                    >
                      <Icon name="lock" size={16} />
                      Bloquear
                    </button>
                  )}
                </div>
              )}
              {can("rates.write") && plan && (
                <form
                  className="sc-rates"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void applyRates();
                  }}
                >
                  <h4>Precio y disponibilidad</h4>
                  <label className="field">
                    <span>Precio por noche ({currency})</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Estancia mínima (noches)</span>
                    <input
                      type="number"
                      min={1}
                      max={730}
                      inputMode="numeric"
                      value={minStay}
                      onChange={(e) => setMinStay(e.target.value)}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={closed}
                      onChange={(e) => setClosed(e.target.checked)}
                    />
                    Cerrar a la venta estas noches
                  </label>
                  <small className="muted">
                    Se aplica al plan «{plan.name}» de todas las unidades tipo{" "}
                    {type?.name}.
                  </small>
                  <button
                    className="button secondary"
                    disabled={busy || price === ""}
                  >
                    {busy
                      ? "Guardando…"
                      : `Aplicar a ${nightCount} ${nightCount === 1 ? "noche" : "noches"}`}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="sc-panel-inner">
          <p className="eyebrow">{monthLabel(month).toUpperCase()}</p>
          <div className="sc-meter">
            <div className="row between">
              <strong>{occupancyPct}%</strong>
              <small>ocupación</small>
            </div>
            <span
              className="sc-meter-bar"
              style={{ "--sc-fill": `${occupancyPct}%` } as CSSProperties}
            />
          </div>
          <dl className="sc-stats">
            <div>
              <dt>Noches reservadas</dt>
              <dd>{booked}</dd>
            </div>
            <div>
              <dt>Bloqueadas</dt>
              <dd>{blocked}</dd>
            </div>
            <div>
              <dt>Libres</dt>
              <dd>{days.length - booked - blocked}</dd>
            </div>
            {can("finance.read") && (
              <div>
                <dt>Ingresos del mes</dt>
                <dd>{money(Math.round(revenue), currency)}</dd>
              </div>
            )}
            <div>
              <dt>Tarifa media</dt>
              <dd>{money(Math.round(published / days.length), currency)}</dd>
            </div>
          </dl>
          {nextArrival && (
            <button
              type="button"
              className="sc-next"
              onClick={() => onPreview({ ...nextArrival })}
            >
              <Icon name="arrival" size={18} />
              <span>
                <small>Próxima llegada</small>
                <strong>{guestName(data.guests, nextArrival.guestId)}</strong>
                <small>
                  {shortDate(nextArrival.arrival)} ·{" "}
                  {statusLabels[nextArrival.status] ?? nextArrival.status}
                </small>
              </span>
            </button>
          )}
          {gaps.length > 0 && (
            <div className="sc-gaps">
              <h4>Noches huérfanas</h4>
              <p className="muted">
                Huecos cortos entre estancias. Selecciónalos para bajar la
                estancia mínima o ajustar el precio.
              </p>
              {gaps.map((g) => (
                <button
                  type="button"
                  key={g.start}
                  className="sc-gap"
                  onClick={() => {
                    setSel({ start: g.start, end: g.end });
                    setPrice(String(rate(g.start).amount / 100));
                    setMinStay("1");
                    setClosed(false);
                  }}
                >
                  {shortDate(g.start)} → {shortDate(g.end)} ·{" "}
                  {dayDistance(g.start, g.end)}{" "}
                  {dayDistance(g.start, g.end) === 1 ? "noche" : "noches"}
                </button>
              ))}
            </div>
          )}
          <p className="sc-help">
            Toca el día de llegada y luego el de salida. En el móvil, desliza el
            calendario a los lados para cambiar de mes.
          </p>
        </div>
      )}
    </aside>
  );

  return (
    <div className={`sc${compact ? " sc-compact" : ""}`}>
      <div className="sc-unitbar">
        <button
          type="button"
          className="icon-button"
          aria-label="Unidad anterior"
          disabled={units.length < 2}
          onClick={() => {
            const i = units.findIndex((u) => u.id === unit.id);
            setUnitId(units[(i - 1 + units.length) % units.length].id);
            setSel(null);
          }}
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <label className="sc-unit-select">
          <span className="sr-only" id={fieldId}>
            Unidad del calendario
          </span>
          <select
            aria-labelledby={fieldId}
            value={unit.id}
            onChange={(e) => {
              setUnitId(e.target.value);
              setSel(null);
            }}
          >
            {calendarRows(units, data.properties).map(({ unit: u, depth }) => (
              <option key={u.id} value={u.id}>
                {depth > 0 ? "\u00a0\u00a0↳ " : ""}
                {u.name}
                {data.inventoryTypes.find((t) => t.id === u.inventoryTypeId)
                  ? ` · ${data.inventoryTypes.find((t) => t.id === u.inventoryTypeId)?.name}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="icon-button"
          aria-label="Unidad siguiente"
          disabled={units.length < 2}
          onClick={() => {
            const i = units.findIndex((u) => u.id === unit.id);
            setUnitId(units[(i + 1) % units.length].id);
            setSel(null);
          }}
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>
      <div className="sc-layout">
        <div
          className="sc-months"
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse")
              swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          }}
          onPointerUp={(e) => {
            if (swipe.current?.id === e.pointerId)
              swipeEnd(e.clientX, e.clientY);
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
          onMouseLeave={() => setHover(null)}
        >
          {months.map((m, mi) => (
            <section
              className={`sc-month${slide ? ` slide-${slide}` : ""}`}
              key={m}
              onAnimationEnd={() => setSlide("")}
            >
              <header className="sc-month-head">
                {mi === 0 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Mes anterior"
                    onClick={() => go(-1)}
                  >
                    <Icon name="chevron-left" size={18} />
                  </button>
                )}
                <h3>{monthLabel(m)}</h3>
                {mi === months.length - 1 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Mes siguiente"
                    onClick={() => go(1)}
                  >
                    <Icon name="chevron-right" size={18} />
                  </button>
                )}
              </header>
              <div className="sc-grid" role="grid" aria-label={monthLabel(m)}>
                {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                  <span className="sc-weekday" key={i} aria-hidden="true">
                    {d}
                  </span>
                ))}
                {monthGrid(m).map((day) => {
                  if (day.slice(0, 7) !== m.slice(0, 7))
                    return (
                      <span key={day} className="sc-day is-outside" aria-hidden="true" />
                    );
                  const o = occupancyOf(day);
                  const stay = o.reservations[0];
                  const own = stay && stay.unitId === unit.id;
                  const block = o.blocks[0];
                  const tail = reservations.find(
                    (r) => r.unitId === unit.id && r.departure === day,
                  );
                  const r = rate(day);
                  const past = day < data.today;
                  const start = sel?.start === day;
                  const endDay = previewEnd === day;
                  // The guest label runs along the nights of this week row
                  // (the bar is one absolutely-positioned piece per cell).
                  const nextMonday = addDays(
                    day,
                    7 - ((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7),
                  );
                  const nextMonth = shiftMonth(m, 1);
                  const segmentEnd = stay
                    ? [stay.departure, nextMonday, nextMonth].sort()[0]
                    : day;
                  const rowNights = stay ? dayDistance(day, segmentEnd) : 0;
                  const isArrival = Boolean(stay && stay.arrival === day);
                  // Bar width units: the arrival cell's bar is half a cell.
                  const labelSpan = isArrival ? rowNights * 2 - 1 : rowNights;
                  const startsHere =
                    stay &&
                    ((isArrival &&
                      (rowNights > 1 || stay.departure === segmentEnd)) ||
                      (!isArrival &&
                        (new Date(day + "T12:00:00Z").getUTCDay() === 1 ||
                          day === m)));
                  return (
                    <button
                      key={day}
                      type="button"
                      role="gridcell"
                      className={`sc-day${past ? " is-past" : ""}${day === data.today ? " is-today" : ""}${stay ? " is-booked" : ""}${block && !stay ? " is-blocked" : ""}${r.closed && !stay && !block ? " is-closed" : ""}${inRange(day) ? " in-range" : ""}${start ? " is-start" : ""}${endDay ? " is-end" : ""}${shake === day ? " is-shake" : ""}`}
                      aria-label={`${day}${stay ? `, reservada${own ? ` por ${guestName(data.guests, stay.guestId)}` : ""}` : block ? ", bloqueada" : `, libre, ${money(r.amount, currency)}`}`}
                      aria-selected={start || endDay}
                      onMouseEnter={() => setHover(day)}
                      onClick={() => {
                        if (stay && !(sel && !sel.end && day > sel.start)) {
                          onPreview({ ...stay });
                          return;
                        }
                        if (block && !stay && !(sel && !sel.end && day > sel.start)) {
                          onBlock(block.id);
                          return;
                        }
                        pick(day);
                      }}
                    >
                      <strong className="sc-num">{Number(day.slice(8))}</strong>
                      {!stay && !block && (
                        <small className="sc-price">
                          {r.closed ? "Cerrado" : cellPrice(r.amount)}
                        </small>
                      )}
                      {block && !stay && (
                        <small className="sc-price">
                          <Icon name="lock" size={11} /> Bloq.
                        </small>
                      )}
                      {tail && (
                        <span className={`sc-bar sc-tail ${tail.status}`} aria-hidden="true" />
                      )}
                      {stay && (
                        <span
                          className={`sc-bar ${own ? stay.status : "related"}${stay.arrival === day ? " is-first" : ""}${flash === stay.id ? " is-moved" : ""}`}
                          aria-hidden="true"
                        >
                          {startsHere && own && (
                            <em
                              style={
                                { "--label-span": labelSpan } as CSSProperties
                              }
                            >
                              {guestName(data.guests, stay.guestId)}
                            </em>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {notice && (
            <p className="notice warning sc-notice" role="alert">
              {notice}
            </p>
          )}
        </div>
        {panel}
      </div>
    </div>
  );
}
