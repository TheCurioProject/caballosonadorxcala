"use client";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import type { InventoryBlock as Block, Reservation, Unit } from "@/cala/domain/model";
import { addDays, overlaps } from "@/cala/domain/shared/dates";
import { unitsConflict } from "@/cala/domain/inventory/availability";
import {
  previewMove,
  shiftedArrival,
} from "@/cala/domain/reservations/movement";
import { dayDistance, selectionRange } from "@/cala/domain/calendar/layout";
import { Icon } from "@/cala/components/ui/primitives";
import { money, shortDate } from "@/cala/lib/format";
import { guestName } from "./components";
import type { CalendarRange } from "./calendar-actions";
import type { Move } from "./calendar";
import {
  haptic,
  isWeekend,
  monthDays,
  useCoarsePointer,
  useStoredChoice,
  weekday,
} from "./calendar-shared";

const guideStates = ["shown", "hidden"] as const;

export type CalendarDisplay = {
  stickyUnits: boolean;
  guest: boolean;
  channel: boolean;
  guests: boolean;
  nights: boolean;
  price: boolean;
  tooltip: boolean;
};

type Proposal = {
  unitId: string;
  arrival: string;
  departure: string;
  valid: boolean;
  same: boolean;
  message: string;
};
type Gesture =
  | {
      kind: "pending";
      id: number;
      type: string;
      x: number;
      y: number;
      target: "cell" | "stay" | "block";
      unitId: string;
      day: string;
      reservation?: Reservation;
      blockId?: string;
      timer?: number;
    }
  | {
      kind: "select";
      id: number;
      unitId: string;
      first: string;
      last: string;
      clipped: boolean;
    }
  | {
      kind: "drag";
      id: number;
      reservation: Reservation;
      grabbed: string;
      proposal: Proposal | null;
    }
  | { kind: "pan"; id: number };

const LONG_PRESS_CELL = 380;
const LONG_PRESS_STAY = 320;
const movable = (r: Reservation) =>
  ["confirmed", "pending", "checked_in"].includes(r.status);

/**
 * Multi-unit month planner. One gesture engine for every pointer:
 *  - finger: swipe pans the month (native scroll), press-and-hold then drag
 *    selects a range, press-and-hold a stay then drag moves it;
 *  - mouse: click-drag selects, drag a stay moves it, wheel/scrollbar pans.
 */
export function MultiCalendar({
  month,
  units,
  reservations,
  occupancy,
  display,
  showProperty = false,
  compact = false,
  flash = null,
  onRange,
  onPreview,
  onBlock,
  onMove,
}: {
  month: string;
  units: Unit[];
  /** Stays drawn as pills (already filtered by channel). */
  reservations: Reservation[];
  /** Every active stay, used to grey out occupied nights. */
  occupancy: Reservation[];
  display: CalendarDisplay;
  showProperty?: boolean;
  compact?: boolean;
  /** Reservation id to celebrate after a confirmed move. */
  flash?: string | null;
  onRange: (range: CalendarRange) => void;
  onPreview: (reservation: Reservation) => void;
  onBlock: (id: string) => void;
  onMove: (move: Move) => void;
}) {
  const { data, can } = useWorkspace();
  const coarsePointer = useCoarsePointer();
  // A real touch also switches the hints, whatever the media query reported.
  const [touchSeen, setTouchSeen] = useState(false);
  const coarse = coarsePointer || touchSeen;
  const days = monthDays(month);
  const count = days.length;
  const first = days[0];
  const end = addDays(days[count - 1], 1);
  const writable =
    data.analyticsComplete !== false &&
    (can("reservation.write") || can("inventory.write"));
  const canMoveStays =
    data.analyticsComplete !== false && can("reservation.write");

  const scroller = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const [selecting, setSelecting] = useState<{
    unitId: string;
    first: string;
    last: string;
    clipped: boolean;
  } | null>(null);
  const [ghost, setGhost] = useState<Proposal | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pressing, setPressing] = useState<string | null>(null);
  const [committed, setCommitted] = useState<{
    unitId: string;
    arrival: string;
    departure: string;
  } | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    text: string;
    tone: "info" | "ok" | "error";
  } | null>(null);
  const [guidePref, setGuidePref] = useStoredChoice(
    "cala.calendar.guide",
    guideStates,
    "shown",
  );
  const guide = guidePref === "shown";
  const toggleGuide = (next: boolean) =>
    setGuidePref(next ? "shown" : "hidden");

  // ---- occupancy lookup --------------------------------------------------
  const info = new Map<
    string,
    { block?: Block; related: boolean; reserved: boolean }
  >();
  for (const u of units)
    for (const day of days) {
      const next = addDays(day, 1);
      info.set(`${u.id}|${day}`, {
        block: data.blocks.find(
          (b) =>
            b.active &&
            overlaps(day, next, b.arrival, b.departure) &&
            unitsConflict(data, u.id, b.unitId),
        ),
        related: occupancy.some(
          (r) =>
            r.unitId &&
            r.unitId !== u.id &&
            overlaps(day, next, r.arrival, r.departure) &&
            unitsConflict(data, u.id, r.unitId),
        ),
        reserved: occupancy.some(
          (r) => r.unitId === u.id && r.arrival <= day && r.departure > day,
        ),
      });
    }
  const cell = (unitId: string, day: string) =>
    info.get(`${unitId}|${day}`) ?? { related: false, reserved: false };
  const held = (unitId: string, day: string) => {
    const c = cell(unitId, day);
    return Boolean(c.block || c.related || c.reserved);
  };
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "";

  // ---- geometry ----------------------------------------------------------
  function hit(x: number, y: number) {
    const track = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-mc-track]");
    if (!track?.dataset.mcTrack) return null;
    const rect = track.getBoundingClientRect();
    const index = Math.max(
      0,
      Math.min(count - 1, Math.floor((x - rect.left) / (rect.width / count))),
    );
    return { unitId: track.dataset.mcTrack, day: days[index] };
  }
  function labelWidth() {
    return (
      scroller.current
        ?.querySelector<HTMLElement>(".mc-corner")
        ?.getBoundingClientRect().width ?? 0
    );
  }

  // ---- smart selection & move proposal -----------------------------------
  function extend(unitId: string, from: string, to: string) {
    const step = to >= from ? 1 : -1;
    let last = from,
      clipped = false;
    for (let d = from; ; d = addDays(d, step)) {
      if (d !== from && held(unitId, d)) {
        clipped = true;
        break;
      }
      last = d;
      if (d === to) break;
    }
    return { last, clipped };
  }
  function propose(
    g: Extract<Gesture, { kind: "drag" }>,
    unitId: string,
    day: string,
  ): Proposal {
    const r = g.reservation;
    const arrival =
      r.status === "checked_in"
        ? r.arrival
        : shiftedArrival(r.arrival, g.grabbed, day);
    const departure = addDays(arrival, dayDistance(r.arrival, r.departure));
    const same = unitId === r.unitId && arrival === r.arrival;
    if (same)
      return {
        unitId,
        arrival,
        departure,
        valid: true,
        same,
        message: "Suelta aquí para dejarla donde estaba.",
      };
    try {
      previewMove(data, r, unitId, arrival);
      return {
        unitId,
        arrival,
        departure,
        valid: true,
        same,
        message: `Soltar en ${unitName(unitId)} · ${shortDate(arrival)} → ${shortDate(departure)}`,
      };
    } catch (e) {
      return {
        unitId,
        arrival,
        departure,
        valid: false,
        same,
        message: e instanceof Error ? e.message : "Destino no disponible",
      };
    }
  }
  function selectionText(unitId: string, a: string, b: string, clip: boolean) {
    const range = selectionRange(a, b);
    const n = dayDistance(range.arrival, range.departure);
    return `${unitName(unitId)} · ${shortDate(range.arrival)} → ${shortDate(range.departure)} · ${n} ${n === 1 ? "noche" : "noches"}${clip ? " · se detiene antes de una fecha ocupada" : ""}`;
  }

  // ---- gesture engine ----------------------------------------------------
  function capture(id: number) {
    try {
      scroller.current?.setPointerCapture(id);
    } catch {
      /* pointer already released */
    }
  }
  function startSelect(id: number, unitId: string, day: string) {
    gesture.current = {
      kind: "select",
      id,
      unitId,
      first: day,
      last: day,
      clipped: false,
    };
    capture(id);
    setPressing(null);
    setSelecting({ unitId, first: day, last: day, clipped: false });
    setStatus({ text: selectionText(unitId, day, day, false), tone: "info" });
    haptic(14);
    autoScroll();
  }
  function startDrag(id: number, reservation: Reservation, grabbed: string) {
    const g: Extract<Gesture, { kind: "drag" }> = {
      kind: "drag",
      id,
      reservation: { ...reservation },
      grabbed,
      proposal: null,
    };
    gesture.current = g;
    capture(id);
    setPressing(null);
    setDragId(reservation.id);
    setStatus({
      text:
        reservation.status === "checked_in"
          ? "Huésped en casa: puedes cambiarla de habitación conservando las fechas."
          : "Arrastra a otra fecha u otra habitación y suelta.",
      tone: "info",
    });
    haptic(18);
    autoScroll();
  }
  function track(x: number, y: number) {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "select") {
      const at = hit(x, y);
      if (!at || at.unitId !== g.unitId) return;
      const next = extend(g.unitId, g.first, at.day);
      if (next.last !== g.last) {
        if (coarse) haptic(4);
        gesture.current = { ...g, ...next };
        setSelecting({ unitId: g.unitId, first: g.first, ...next });
        setStatus({
          text: selectionText(g.unitId, g.first, next.last, next.clipped),
          tone: next.clipped ? "error" : "info",
        });
      }
    } else if (g.kind === "drag") {
      const at = hit(x, y);
      if (!at) return;
      const p = propose(g, at.unitId, at.day);
      const old = g.proposal;
      if (old && old.unitId === p.unitId && old.arrival === p.arrival) return;
      if (coarse) haptic(p.valid ? 5 : [5, 30, 5]);
      g.proposal = p;
      setGhost(p);
      setStatus({ text: p.message, tone: p.valid ? "ok" : "error" });
    }
  }
  // Keep the RAF loop reading the latest render's closures.
  const latest = useRef({ track, labelWidth });
  useEffect(() => {
    latest.current = { track, labelWidth };
  });
  function autoScroll() {
    if (frame.current !== null) return;
    const tick = () => {
      frame.current = null;
      const g = gesture.current,
        el = scroller.current,
        p = pointer.current;
      if (!g || (g.kind !== "select" && g.kind !== "drag") || !el) return;
      if (p) {
        const rect = el.getBoundingClientRect();
        const left = rect.left + latest.current.labelWidth();
        const edge = 44;
        let dx = 0,
          dy = 0;
        if (p.x < left + edge) dx = -Math.min(22, (left + edge - p.x) / 3);
        else if (p.x > rect.right - edge)
          dx = Math.min(22, (p.x - rect.right + edge) / 3);
        if (p.y < 80) dy = -10;
        else if (p.y > window.innerHeight - 110) dy = 10;
        if (dx) el.scrollLeft += dx;
        if (dy) window.scrollBy(0, dy);
        if (dx || dy) latest.current.track(p.x, p.y);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function stopAutoScroll() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }
  useEffect(() => stopAutoScroll, []);

  // While selecting or dragging with a finger the page must not scroll.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      const kind = gesture.current?.kind;
      if (kind === "select" || kind === "drag") e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  // Land on today (or the 1st) whenever the month changes. Waits until the
  // grid is actually wider than the viewport (styles/fonts may load late).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let done = false;
    const land = () => {
      if (done || el.scrollWidth <= el.clientWidth + 1) return;
      done = true;
      const head = el.querySelector<HTMLElement>(
        `[data-mc-day="${data.today}"]`,
      );
      const label =
        el.querySelector<HTMLElement>(".mc-corner")?.offsetWidth ?? 0;
      el.scrollTo({
        left: head
          ? Math.max(0, head.offsetLeft - label - head.offsetWidth)
          : 0,
        behavior: "smooth",
      });
    };
    land();
    const observer = new ResizeObserver(land);
    const grid = el.querySelector(".mc-grid");
    if (grid) observer.observe(grid);
    observer.observe(el);
    const stop = () => {
      done = true;
    };
    el.addEventListener("pointerdown", stop, { once: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("pointerdown", stop);
    };
  }, [month, data.today]);

  function reset() {
    const g = gesture.current;
    if (g?.kind === "pending" && g.timer) clearTimeout(g.timer);
    gesture.current = null;
    stopAutoScroll();
    setPressing(null);
    setSelecting(null);
    setGhost(null);
    setDragId(null);
  }
  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current && gesture.current.kind !== "pan") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const at = hit(e.clientX, e.clientY);
    if (!at) return;
    const touch = e.pointerType !== "mouse";
    if (touch && !touchSeen) setTouchSeen(true);
    pointer.current = { x: e.clientX, y: e.clientY };
    const base = {
      kind: "pending" as const,
      id: e.pointerId,
      type: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      unitId: at.unitId,
      day: at.day,
    };
    const stayEl = target.closest<HTMLElement>("[data-mc-stay]");
    if (stayEl) {
      const r = reservations.find((x) => x.id === stayEl.dataset.mcStay);
      if (!r) return;
      const g: Extract<Gesture, { kind: "pending" }> = {
        ...base,
        target: "stay",
        reservation: r,
      };
      if (touch && canMoveStays && movable(r)) {
        setPressing(`stay:${r.id}`);
        g.timer = window.setTimeout(() => {
          if (gesture.current === g) startDrag(g.id, r, g.day);
        }, LONG_PRESS_STAY);
      }
      gesture.current = g;
      return;
    }
    if (!target.closest("[data-mc-cell]")) return;
    const c = cell(at.unitId, at.day);
    if (c.block) {
      gesture.current = { ...base, target: "block", blockId: c.block.id };
      return;
    }
    if (c.related || c.reserved || !writable) return;
    if (!touch) {
      e.preventDefault();
      startSelect(e.pointerId, at.unitId, at.day);
      return;
    }
    const g: Extract<Gesture, { kind: "pending" }> = { ...base, target: "cell" };
    setPressing(`cell:${at.unitId}:${at.day}`);
    g.timer = window.setTimeout(() => {
      if (gesture.current === g) startSelect(g.id, g.unitId, g.day);
    }, LONG_PRESS_CELL);
    gesture.current = g;
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (g.kind === "pending") {
      const distance = Math.hypot(e.clientX - g.x, e.clientY - g.y);
      if (g.type === "mouse") {
        if (
          g.target === "stay" &&
          distance > 4 &&
          g.reservation &&
          canMoveStays &&
          movable(g.reservation)
        ) {
          if (g.timer) clearTimeout(g.timer);
          startDrag(g.id, g.reservation, g.day);
        }
        return;
      }
      if (distance > 9) {
        // A swipe: hand the gesture to native scrolling.
        if (g.timer) clearTimeout(g.timer);
        setPressing(null);
        gesture.current = { kind: "pan", id: g.id };
      }
      return;
    }
    track(e.clientX, e.clientY);
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    stopAutoScroll();
    setPressing(null);
    if (g.kind === "pending") {
      if (g.timer) clearTimeout(g.timer);
      if (g.target === "stay" && g.reservation) onPreview({ ...g.reservation });
      else if (g.target === "block" && g.blockId) onBlock(g.blockId);
      else if (g.target === "cell")
        onRange({
          unitId: g.unitId,
          arrival: g.day,
          departure: addDays(g.day, 1),
        });
      return;
    }
    if (g.kind === "select") {
      const range = { unitId: g.unitId, ...selectionRange(g.first, g.last) };
      setSelecting(null);
      setCommitted(range);
      setStatus({
        text: `Seleccionado: ${selectionText(g.unitId, g.first, g.last, false)}`,
        tone: "ok",
      });
      haptic([8, 40, 8]);
      window.setTimeout(() => onRange(range), 220);
      window.setTimeout(() => setCommitted(null), 900);
      return;
    }
    if (g.kind === "drag") {
      setDragId(null);
      setGhost(null);
      const p = g.proposal;
      if (p && p.valid && !p.same) {
        haptic([10, 30, 10]);
        setStatus({ text: `Revisa y confirma: ${p.message}`, tone: "ok" });
        onMove({
          reservation: g.reservation,
          unitId: p.unitId,
          arrival: p.arrival,
        });
      } else {
        setRejected(g.reservation.id);
        window.setTimeout(() => setRejected(null), 520);
        if (p && !p.valid) {
          haptic([30, 40, 30]);
          setStatus({ text: p.message, tone: "error" });
        } else setStatus(null);
      }
    }
  }
  function cancel(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.kind === "drag" || g.kind === "select")
      setStatus({ text: "Gesto cancelado.", tone: "info" });
    reset();
  }

  // ---- render helpers ----------------------------------------------------
  function span(arrival: string, departure: string) {
    const start = arrival < first ? 0 : dayDistance(first, arrival);
    const stop = departure >= end ? count : dayDistance(first, departure) + 1;
    const cols = Math.max(1, stop - start);
    const half = `calc(100% / ${cols} / 2)`;
    return {
      style: {
        gridColumn: `${start + 1} / span ${cols}`,
        gridRow: 1,
        marginLeft: arrival >= first ? half : 0,
        marginRight: departure < end ? half : 0,
      } as CSSProperties,
      clip: `${arrival < first ? " clip-start" : ""}${departure >= end ? " clip-end" : ""}`,
    };
  }
  const meta = (r: Reservation) =>
    [
      display.channel ? r.source : null,
      display.guests ? `${r.adults + r.children} huésp.` : null,
      display.nights ? `${dayDistance(r.arrival, r.departure)} n` : null,
      display.price && can("finance.read")
        ? money(r.totalMinor, r.currency)
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const label = (r: Reservation) =>
    display.guest ? guestName(data.guests, r.guestId) : r.confirmationCode;
  const selDates = selecting
    ? selectionRange(selecting.first, selecting.last)
    : null;
  const hint = coarse
    ? "Desliza para recorrer el mes · Mantén pulsado un día y arrastra para seleccionar · Mantén pulsada una reserva y arrástrala para moverla."
    : "Haz clic y arrastra sobre los días para seleccionar · Arrastra una reserva a otra fecha o habitación para moverla.";

  return (
    <div
      className={`mc${compact ? " mc-compact" : ""}${dragId ? " is-dragging" : ""}${selecting ? " is-selecting" : ""}`}
    >
      {guide ? (
        <div className="mc-guide" role="note">
          <span>
            <i aria-hidden="true">↔</i>
            <b>{coarse ? "Desliza" : "Desplaza"}</b>
            {coarse ? "recorre todo el mes" : "con la rueda o la barra"}
          </span>
          <span>
            <i aria-hidden="true" className="mc-guide-hold" />
            <b>{coarse ? "Mantén y arrastra" : "Clic y arrastra"}</b>
            selecciona fechas libres
          </span>
          <span>
            <i aria-hidden="true">⠿</i>
            <b>Arrastra una reserva</b>
            muévela de fecha o habitación
          </span>
          <button
            type="button"
            className="mc-guide-close"
            aria-label="Ocultar guía de gestos"
            onClick={() => toggleGuide(false)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}
      <div
        ref={scroller}
        className="mc-scroll"
        role="group"
        aria-label="Calendario por unidad. Desliza horizontalmente para recorrer el mes."
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onContextMenu={(e) => {
          if (gesture.current || coarse) e.preventDefault();
        }}
      >
        <div
          className="mc-grid"
          data-sticky={display.stickyUnits}
          style={{ "--mc-days": count } as CSSProperties}
        >
          <div className="mc-row mc-head">
            <div className="mc-label mc-corner">
              {compact ? "Unidad" : "Unidad / inventario"}
            </div>
            <div className="mc-days">
              {days.map((d) => (
                <div
                  key={d}
                  data-mc-day={d}
                  className={`mc-day${d === data.today ? " is-today" : ""}${isWeekend(d) ? " is-weekend" : ""}${d < data.today ? " is-past" : ""}`}
                >
                  <small>{weekday(d)}</small>
                  <strong>{Number(d.slice(8))}</strong>
                </div>
              ))}
            </div>
          </div>
          {units.map((u, index) => (
            <Fragment key={u.id}>
              {showProperty &&
                (index === 0 ||
                  units[index - 1].propertyId !== u.propertyId) && (
                  <div className="mc-property">
                    <span>
                      {data.properties.find((p) => p.id === u.propertyId)?.name}
                    </span>
                  </div>
                )}
              <div className="mc-row">
                <div className="mc-label">
                  <strong>{u.name}</strong>
                  <small>
                    {
                      data.inventoryTypes.find(
                        (i) => i.id === u.inventoryTypeId,
                      )?.name
                    }
                  </small>
                </div>
                <div
                  className={`mc-track${ghost?.unitId === u.id ? (ghost.valid ? " drop-ok" : " drop-bad") : ""}`}
                  data-mc-track={u.id}
                >
                  {days.map((day, i) => {
                    const c = cell(u.id, day);
                    const busy = c.related || c.reserved;
                    const inSelection =
                      selecting?.unitId === u.id &&
                      selDates &&
                      day >= selDates.arrival &&
                      day < selDates.departure;
                    return (
                      <button
                        key={day}
                        type="button"
                        tabIndex={-1}
                        data-mc-cell
                        className={`mc-cell${day === data.today ? " is-today" : ""}${isWeekend(day) ? " is-weekend" : ""}${day < data.today ? " is-past" : ""}${c.block ? " is-blocked" : ""}${busy ? " is-busy" : ""}${inSelection ? " is-selected" : ""}${pressing === `cell:${u.id}:${day}` ? " is-pressing" : ""}`}
                        style={{ gridColumn: i + 1, gridRow: 1 }}
                        aria-disabled={busy || (!c.block && !writable)}
                        aria-label={`${c.block ? "Bloqueada" : busy ? "Ocupada" : "Libre"} · ${u.name} · ${day}`}
                        title={
                          c.block?.reason ??
                          (c.related
                            ? "Ocupada por una reserva del espacio relacionado"
                            : undefined)
                        }
                        onClick={(e) => {
                          // Pointer taps are handled by the gesture engine;
                          // this path is for keyboard activation only.
                          if (e.detail !== 0) return;
                          if (c.block) onBlock(c.block.id);
                          else if (!busy && writable)
                            onRange({
                              unitId: u.id,
                              arrival: day,
                              departure: addDays(day, 1),
                            });
                        }}
                      >
                        {c.block || c.related ? (
                          <Icon name="lock" size={12} />
                        ) : c.reserved ? null : (
                          <span className="mc-plus">+</span>
                        )}
                      </button>
                    );
                  })}
                  {selecting?.unitId === u.id && selDates && (
                    <div
                      className={`mc-selection${selecting.clipped ? " is-clipped" : ""}`}
                      style={{
                        gridRow: 1,
                        gridColumn: `${dayDistance(first, selDates.arrival) + 1} / span ${dayDistance(selDates.arrival, selDates.departure)}`,
                      }}
                      aria-hidden="true"
                    >
                      <span>
                        {dayDistance(selDates.arrival, selDates.departure)} n
                      </span>
                    </div>
                  )}
                  {committed?.unitId === u.id &&
                    overlaps(first, end, committed.arrival, committed.departure) && (
                      <div
                        className="mc-selection is-committed"
                        style={{
                          gridRow: 1,
                          gridColumn: `${Math.max(0, dayDistance(first, committed.arrival)) + 1} / span ${Math.min(count, dayDistance(first, committed.departure)) - Math.max(0, dayDistance(first, committed.arrival))}`,
                        }}
                        aria-hidden="true"
                      >
                        <Icon name="check" size={14} />
                      </div>
                    )}
                  {reservations
                    .filter(
                      (r) =>
                        r.unitId === u.id &&
                        overlaps(first, end, r.arrival, r.departure),
                    )
                    .map((r) => {
                      const s = span(r.arrival, r.departure);
                      const canMove = canMoveStays && movable(r);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          data-mc-stay={r.id}
                          className={`mc-stay ${r.status}${s.clip}${dragId === r.id ? " is-source" : ""}${rejected === r.id ? " is-rejected" : ""}${flash === r.id ? " is-moved" : ""}${pressing === `stay:${r.id}` ? " is-pressing" : ""}${canMove ? " is-movable" : ""}`}
                          style={s.style}
                          title={
                            display.tooltip
                              ? `${label(r)} · ${shortDate(r.arrival)} — ${shortDate(r.departure)} · ${dayDistance(r.arrival, r.departure)} noches`
                              : undefined
                          }
                          aria-label={`${label(r)}, ${u.name}, ${shortDate(r.arrival)} a ${shortDate(r.departure)}`}
                          onClick={(e) => {
                            if (e.detail === 0) onPreview({ ...r });
                          }}
                        >
                          <span className="mc-stay-text">
                            <strong>{label(r)}</strong>
                            {meta(r) && <small>{meta(r)}</small>}
                          </span>
                          {canMove && !compact && (
                            <span className="mc-grip" aria-hidden="true">
                              ⠿
                            </span>
                          )}
                        </button>
                      );
                    })}
                  {ghost?.unitId === u.id && !ghost.same && (
                    <div
                      className={`mc-ghost${ghost.valid ? " ok" : " bad"}`}
                      style={span(ghost.arrival, ghost.departure).style}
                      aria-hidden="true"
                    >
                      <span>
                        {ghost.valid ? (
                          <>
                            {shortDate(ghost.arrival)} →{" "}
                            {shortDate(ghost.departure)}
                          </>
                        ) : (
                          "No disponible"
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      <div className="mc-foot">
        <p
          className={`mc-status${status ? ` tone-${status.tone}` : ""}`}
          role="status"
          aria-live="polite"
        >
          {status?.text ?? hint}
        </p>
        <div className="mc-legend">
          <span>
            <i className="mc-dot confirmed" />
            Confirmada
          </span>
          <span>
            <i className="mc-dot checked_in" />
            En casa
          </span>
          <span>
            <i className="mc-dot pending" />
            Pendiente
          </span>
          <span>
            <i className="mc-dot blocked" />
            Bloqueada
          </span>
          {!guide && (
            <button
              type="button"
              className="mc-guide-open"
              onClick={() => toggleGuide(true)}
            >
              <Icon name="help" size={14} />
              Gestos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
