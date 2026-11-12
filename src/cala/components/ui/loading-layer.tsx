"use client";
/**
 * Global loading feedback for CALA. Mounted once around the whole admin:
 *  - a thin tide bar on top as soon as something takes longer than a blink;
 *  - a status pill with the CALA mark (and evolving copy) when it takes longer;
 *  - the button that started the action shows the mark and ignores repeat
 *    taps until the work is done;
 *  - section links register a navigation until the new route renders.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  beginActivity,
  endActivities,
  installFetchTracking,
  subscribeActivity,
  getActivity,
  useActivity,
} from "@/cala/lib/activity";
import { CalaMark, useWaitMessage } from "./cala-loader";
import { useOptionalT } from "@/cala/lib/i18n";

const BAR_DELAY = 160;
const PILL_DELAY = 900;
const PRESS_WINDOW = 1500;
const NAVIGATION_TIMEOUT = 20000;
const PRESSABLE =
  'button, [role="button"], a.button, input[type="submit"], input[type="button"]';

let navigationTimer: ReturnType<typeof setTimeout> | undefined;
/** Registers a route change; call before `router.push` for programmatic moves. */
export function startNavigation(href?: string) {
  if (href !== undefined && typeof window !== "undefined") {
    const target = new URL(href, window.location.href).pathname;
    if (target.replace(/\/$/, "") === window.location.pathname.replace(/\/$/, ""))
      return;
  }
  endActivities("navigate");
  beginActivity("navigate");
  clearTimeout(navigationTimer);
  navigationTimer = setTimeout(
    () => endActivities("navigate"),
    NAVIGATION_TIMEOUT,
  );
}

export function CalaLoadingLayer() {
  const { items } = useActivity();
  const pathname = usePathname();
  const active = items.length > 0;
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  useEffect(() => installFetchTracking(), []);

  // Route rendered: navigation finished.
  useEffect(() => {
    endActivities("navigate");
  }, [pathname]);

  // Section links: show progress until the new route is on screen.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const here = window.location.pathname.replace(/\/$/, "");
      if (url.pathname.replace(/\/$/, "") === here) return;
      startNavigation();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // The control the user pressed shows the loading state of its action.
  const pressed = useRef<{ element: Element; at: number } | null>(null);
  useEffect(() => {
    const marked = new Set<Element>();
    let count = getActivity().items.length;
    const remember = (element: Element | null | undefined) => {
      if (element) pressed.current = { element, at: Date.now() };
    };
    const onClick = (event: MouseEvent) =>
      remember((event.target as Element | null)?.closest?.(PRESSABLE));
    const onSubmit = (event: SubmitEvent) =>
      remember(
        event.submitter ??
          (event.target as HTMLFormElement).querySelector(
            'button:not([type="button"]), input[type="submit"]',
          ),
      );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ")
        remember((event.target as Element | null)?.closest?.(PRESSABLE));
    };
    const unsubscribe = subscribeActivity(() => {
      const items = getActivity().items;
      const started = items.length > count;
      count = items.length;
      if (!items.length) {
        for (const element of marked) {
          element.removeAttribute("data-cala-loading");
          element.removeAttribute("aria-busy");
        }
        marked.clear();
        return;
      }
      const press = pressed.current;
      if (
        started &&
        press &&
        Date.now() - press.at < PRESS_WINDOW &&
        press.element.isConnected &&
        items[items.length - 1].kind !== "navigate"
      ) {
        press.element.setAttribute("data-cala-loading", "true");
        press.element.setAttribute("aria-busy", "true");
        marked.add(press.element);
        pressed.current = null;
      }
    });
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      unsubscribe();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKey, true);
      for (const element of marked) {
        element.removeAttribute("data-cala-loading");
        element.removeAttribute("aria-busy");
      }
    };
  }, []);

  // Stage 1 = tide bar, stage 2 = status pill. Quick actions show nothing.
  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.removeAttribute("data-cala-activity");
      const timer = setTimeout(() => setStage(0), 0);
      return () => clearTimeout(timer);
    }
    root.setAttribute("data-cala-activity", "true");
    const bar = setTimeout(() => setStage(1), BAR_DELAY);
    const pill = setTimeout(() => setStage(2), PILL_DELAY);
    return () => {
      clearTimeout(bar);
      clearTimeout(pill);
    };
  }, [active]);

  const current =
    [...items].reverse().find((item) => item.kind !== "navigate") ??
    items[items.length - 1];
  const since = items.length
    ? Math.min(...items.map((item) => item.startedAt))
    : undefined;

  return (
    <>
      <div
        aria-hidden="true"
        className="cala-tide-bar"
        data-visible={active && stage >= 1 ? "true" : "false"}
      >
        <span />
      </div>
      {active && stage === 2 && current && (
        <ActivityPill label={current.label} since={since} key={since} />
      )}
    </>
  );
}

function ActivityPill({ label, since }: { label: string; since?: number }) {
  const t = useOptionalT();
  const message = useWaitMessage(label, since);
  return (
    <div aria-live="polite" className="cala-activity-pill" role="status">
      <CalaMark size={26} />
      <span>{t(message)}</span>
    </div>
  );
}
