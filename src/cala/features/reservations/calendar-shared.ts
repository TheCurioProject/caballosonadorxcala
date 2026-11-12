"use client";
import { uiLocale } from "@/cala/lib/format";
import { useCallback, useSyncExternalStore } from "react";
import { monthStart } from "@/cala/domain/calendar/layout";
import { addDays } from "@/cala/domain/shared/dates";

/** Every day of the month that contains `value`, from the 1st to the last. */
export function monthDays(value: string) {
  const first = monthStart(value);
  const days: string[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1))
    days.push(d);
  return days;
}

export function monthLabel(value: string, locale = uiLocale()) {
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(monthStart(value) + "T12:00:00Z"));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

export function weekday(value: string, locale = uiLocale()) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}

export const isWeekend = (value: string) => {
  const d = new Date(value + "T12:00:00Z").getUTCDay();
  return d === 0 || d === 6;
};

/** Short, optional haptic tick (Android/Chrome; silently ignored elsewhere). */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

const coarse = "(pointer: coarse)";
function subscribeCoarse(notify: () => void) {
  const q = window.matchMedia(coarse);
  q.addEventListener("change", notify);
  return () => q.removeEventListener("change", notify);
}
/** True when the primary pointer is a finger (phones, tablets). */
export function useCoarsePointer() {
  return useSyncExternalStore(
    subscribeCoarse,
    () =>
      window.matchMedia(coarse).matches ||
      (navigator.maxTouchPoints > 0 &&
        window.matchMedia("(hover: none)").matches),
    () => false,
  );
}

const storeListeners = new Set<() => void>();
function subscribeStore(notify: () => void) {
  storeListeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    storeListeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}
/** A small per-browser preference (falls back silently without storage). */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) {
  const value = useSyncExternalStore(
    subscribeStore,
    () => {
      try {
        const saved = localStorage.getItem(key) as T | null;
        return saved && allowed.includes(saved) ? saved : fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const update = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        /* storage unavailable */
      }
      storeListeners.forEach((notify) => notify());
    },
    [key],
  );
  return [value, update] as const;
}

export type CalendarLayout = "multiple" | "single";
const layouts = ["multiple", "single"] as const;
/** Smoobu-style "Múltiple / Individual" switch, remembered per browser. */
export function useCalendarLayout() {
  return useStoredChoice<CalendarLayout>(
    "cala.calendar.layout",
    layouts,
    "multiple",
  );
}

type TreeUnit = { id: string; propertyId: string; name: string; parentUnitId: string | null };
type TreeProperty = { id: string; name: string; websiteLinked?: boolean };
export type CalendarRow<U extends TreeUnit> = {
  unit: U;
  /** 0 for a house or a standalone unit, 1+ for its rooms. */
  depth: number;
  /** True when the unit has rooms among the visible units. */
  house: boolean;
  /** True for the last room of its house (closes the tree guide). */
  lastChild: boolean;
};

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/**
 * Orders units like a property tree: properties (website one first), then
 * each house directly followed by its rooms ("Room 2" before "Room 10").
 * A room whose house is filtered out stays in its property, at depth 1.
 */
export function calendarRows<U extends TreeUnit>(
  units: U[],
  properties: TreeProperty[],
): CalendarRow<U>[] {
  const visible = new Set(units.map((u) => u.id));
  const propertyRank = (id: string) => {
    const index = properties.findIndex((p) => p.id === id);
    const p = properties[index];
    return index < 0 ? Number.MAX_SAFE_INTEGER : (p.websiteLinked ? 0 : 1) * 1e6 + index;
  };
  const children = new Map<string, U[]>();
  for (const u of units)
    if (u.parentUnitId && visible.has(u.parentUnitId))
      children.set(u.parentUnitId, [...(children.get(u.parentUnitId) ?? []), u]);
  const roots = units
    .filter((u) => !u.parentUnitId || !visible.has(u.parentUnitId))
    .sort(
      (a, b) =>
        propertyRank(a.propertyId) - propertyRank(b.propertyId) ||
        // Houses before stray rooms and standalone units of the same property.
        Number(Boolean(a.parentUnitId)) - Number(Boolean(b.parentUnitId)) ||
        Number(children.has(b.id)) - Number(children.has(a.id)) ||
        byName(a, b),
    );
  const rows: CalendarRow<U>[] = [];
  const walk = (u: U, depth: number, lastChild: boolean) => {
    const kids = [...(children.get(u.id) ?? [])].sort(byName);
    rows.push({ unit: u, depth: depth || (u.parentUnitId ? 1 : 0), house: kids.length > 0, lastChild });
    kids.forEach((k, i) => walk(k, depth + 1, i === kids.length - 1));
  };
  for (const r of roots) walk(r, 0, false);
  return rows;
}
