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
