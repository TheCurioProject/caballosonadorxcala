"use client";
/**
 * Pending-work registry behind CALA's loading feedback (top bar, status pill,
 * pressed-button state). Anything the user is waiting on registers here:
 *  - `api()` calls (except background polling) register themselves;
 *  - other same-origin writes (website modules, server actions, uploads) are
 *    caught by `installFetchTracking()`;
 *  - section navigation is registered by the loading layer on link clicks.
 */
import { useSyncExternalStore } from "react";
import { beginLoad } from "./load-progress";

export type ActivityKind = "save" | "load" | "navigate";
export interface Activity {
  id: number;
  kind: ActivityKind;
  label: string;
  startedAt: number;
}
export interface ActivityState {
  items: readonly Activity[];
}

let sequence = 0;
let state: ActivityState = { items: [] };
const listeners = new Set<() => void>();
const EMPTY: ActivityState = { items: [] };

function emit() {
  for (const listener of listeners) listener();
}

export const defaultActivityLabel: Record<ActivityKind, string> = {
  save: "Guardando cambios…",
  load: "Cargando…",
  navigate: "Abriendo sección…",
};

const loadEnders = new Map<number, () => void>();
export function beginActivity(kind: ActivityKind, label?: string) {
  const id = ++sequence;
  // Requests feed the fill progress from the fetch hook; a route change is
  // one more step that only finishes once the new screen is rendered.
  const endLoad = kind === "navigate" ? beginLoad() : null;
  if (endLoad) loadEnders.set(id, endLoad);
  state = {
    items: [
      ...state.items,
      {
        id,
        kind,
        label: label ?? defaultActivityLabel[kind],
        startedAt: Date.now(),
      },
    ],
  };
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    endLoad?.();
    loadEnders.delete(id);
    state = { items: state.items.filter((item) => item.id !== id) };
    emit();
  };
}

/** Clears every activity of one kind (e.g. navigation once the route changed). */
export function endActivities(kind: ActivityKind) {
  if (!state.items.some((item) => item.kind === kind)) return;
  for (const item of state.items)
    if (item.kind === kind) {
      loadEnders.get(item.id)?.();
      loadEnders.delete(item.id);
    }
  state = { items: state.items.filter((item) => item.kind !== kind) };
  emit();
}

export async function trackActivity<T>(
  work: Promise<T>,
  kind: ActivityKind = "save",
  label?: string,
): Promise<T> {
  const end = beginActivity(kind, label);
  try {
    return await work;
  } finally {
    end();
  }
}

export function subscribeActivity(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getActivity() {
  return state;
}
export function useActivity() {
  return useSyncExternalStore(subscribeActivity, getActivity, () => EMPTY);
}

let fetchPatched = false;
/**
 * Registers same-origin writes that don't go through `api()` (Casa Caballo
 * Soñador modules, Next server actions, image uploads). Reads stay silent so
 * prefetches and background refreshes never flash a loader, but every
 * same-origin request counts towards the real progress the fill shows.
 */
export function installFetchTracking() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL | null = null;
    try {
      url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
        window.location.href,
      );
    } catch {
      url = null;
    }
    const method = (
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase();
    const sameOrigin = url !== null && url.origin === window.location.origin;
    const tracked =
      sameOrigin &&
      method !== "GET" &&
      method !== "HEAD" &&
      // `api()` registers its own calls with a precise label.
      !url?.pathname.startsWith("/api/cala/");
    const endLoad = sameOrigin ? beginLoad() : null;
    const request = original(input, init);
    if (endLoad) request.then(endLoad, endLoad);
    if (!tracked) return request;
    return trackActivity(request, "save", "Procesando…");
  };
}
