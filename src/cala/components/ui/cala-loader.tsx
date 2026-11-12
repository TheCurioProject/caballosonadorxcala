"use client";
/**
 * CALA's loading mark: the isotype fills with solid color from the bottom up
 * as the real work progresses (see `@/cala/lib/load-progress`). The liquid is
 * redrawn frame by frame from one shared `requestAnimationFrame` loop: its
 * level follows the progress and its surface ripples only while it moves,
 * settling flat when the mark is full. Colors follow `currentColor` (the
 * theme accent by default), so it works in every CALA theme and inside the
 * Casa Caballo Soñador modules.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useOptionalT } from "@/cala/lib/i18n";
import { installFetchTracking } from "@/cala/lib/activity";
import {
  FillSmoother,
  onFrame,
  prefersReducedMotion,
} from "@/cala/lib/load-progress";

const ISOTYPE =
  "M318 72 C236 62 153 83 98 135 C44 186 34 263 59 328 C87 402 157 445 233 437 C291 431 347 405 390 365 C427 330 454 285 461 239 C467 200 446 164 411 153 C381 144 354 155 329 178 L268 235 C244 258 210 270 181 256 C146 240 135 196 158 165 C177 139 210 127 245 128 C283 130 314 111 328 82 C333 72 328 73 318 72 Z M398 235 C393 272 370 307 340 335 C309 363 271 381 234 386 C188 392 146 367 128 326 C116 299 117 269 130 246 C140 270 157 288 180 299 C224 320 274 305 311 270 L365 220 C377 209 391 212 398 222 C400 225 400 231 398 235 Z";
// Vertical extent of the isotype inside the viewBox (with a little margin so
// 0% is fully empty and 100% fully solid, ripples included).
const EMPTY_Y = 450;
const FULL_Y = 56;
const STEPS = 24;

/** Liquid body: a rippled surface at `level` (0…1) down past the bottom. */
function liquidPath(level: number, amplitude: number, phase: number) {
  const y = EMPTY_Y - level * (EMPTY_Y - FULL_Y);
  let d = "";
  for (let i = 0; i <= STEPS; i++) {
    const x = 20 + (i * 460) / STEPS;
    const wave =
      Math.sin(phase + i * 0.44) * 0.7 + Math.sin(phase * 1.6 - i * 0.27) * 0.3;
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${(y + amplitude * wave).toFixed(1)}`;
  }
  return d + "L480 470L20 470Z";
}
const EMPTY_LIQUID = liquidPath(0, 0, 0);

export function CalaMark({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = "cala-mark-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const liquid = useRef<SVGPathElement>(null);

  useEffect(() => {
    installFetchTracking();
    const smoother = new FillSmoother();
    const still = prefersReducedMotion();
    let phase = Math.random() * Math.PI * 2;
    let lastPath = EMPTY_LIQUID;
    let lastPercent = -1;
    return onFrame((time, dt) => {
      const value = smoother.step(time, dt);
      phase += dt * 0.0058;
      // Ripples only while filling: flat when empty and when full.
      const amplitude = still ? 0 : 12 * Math.sin(Math.PI * value);
      const path = liquidPath(value, amplitude, phase);
      if (path !== lastPath) {
        liquid.current?.setAttribute("d", path);
        lastPath = path;
      }
      const percent = Math.round(value * 100);
      if (percent !== lastPercent) {
        svg.current?.setAttribute("data-progress", String(percent));
        svg.current?.toggleAttribute("data-full", percent === 100);
        lastPercent = percent;
      }
    });
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={`cala-mark ${className}`.trim()}
      data-progress="0"
      focusable="false"
      height={Math.round((size * 400) / 452)}
      ref={svg}
      viewBox="24 52 452 400"
      width={size}
    >
      <defs>
        <clipPath id={id}>
          <path clipRule="evenodd" d={ISOTYPE} />
        </clipPath>
      </defs>
      <path className="cala-mark-base" d={ISOTYPE} fillRule="evenodd" />
      <path
        className="cala-mark-liquid"
        clipPath={`url(#${id})`}
        d={EMPTY_LIQUID}
        ref={liquid}
      />
    </svg>
  );
}

/**
 * Keeps a loader on screen a moment after `loading` turns false, so the mark
 * can finish filling to the top instead of vanishing half full.
 */
export function useLoaderExit(loading: boolean, hold = 480) {
  const [visible, setVisible] = useState(loading);
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const reduced = prefersReducedMotion();
    const timer = setTimeout(() => setVisible(false), reduced ? 120 : hold);
    return () => clearTimeout(timer);
  }, [loading, hold]);
  return loading || visible;
}

/** Reassuring copy that evolves while the user keeps waiting. */
export function useWaitMessage(label: string, since?: number) {
  const [now, setNow] = useState(() => Date.now());
  const [start] = useState(() => since ?? Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = now - (since ?? start);
  if (elapsed > 15000) return "La conexión va lenta. Seguimos trabajando, no cierres esta ventana.";
  if (elapsed > 6000) return "Sigue en proceso, gracias por esperar…";
  return label;
}

/** Centered loader for sections, dialogs and route transitions. */
export function CalaLoader({
  label = "Cargando…",
  size = "md",
  className = "",
  hint,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  hint?: string;
}) {
  const t = useOptionalT();
  const message = useWaitMessage(label);
  const px = size === "lg" ? 92 : size === "sm" ? 34 : 58;
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`cala-loader cala-loader-${size} ${className}`.trim()}
      role="status"
    >
      <CalaMark size={px} />
      <p className="cala-loader-label">{t(message)}</p>
      {hint && <p className="cala-loader-hint">{t(hint)}</p>}
    </div>
  );
}

/** Full-screen splash used while CALA itself opens. */
export function CalaSplash({ label = "Abriendo CALA…" }: { label?: string }) {
  const t = useOptionalT();
  const message = useWaitMessage(label);
  return (
    <div aria-busy="true" aria-live="polite" className="cala-splash" role="status">
      <div className="cala-splash-mark">
        <CalaMark size={104} />
        <span className="cala-splash-word" aria-hidden="true">
          CALA
        </span>
      </div>
      <p className="cala-loader-label">{t(message)}</p>
    </div>
  );
}

/**
 * Drop-in for lucide's `Loader2` in the website modules: same props, CALA
 * mark instead of a generic spinner (its own motion, so `animate-spin` is
 * ignored).
 */
export function CalaSpinner({
  className = "",
  size,
}: {
  className?: string;
  size?: number;
}) {
  const sizeClass = className.match(/\bw-(\d+(?:\.\d+)?)\b/);
  const px = size ?? (sizeClass ? Number(sizeClass[1]) * 4 : 16);
  const rest = className
    .split(/\s+/)
    .filter((c) => c && c !== "animate-spin" && !/^(w|h)-/.test(c))
    .join(" ");
  return (
    <span className={`cala-spinner ${rest}`.trim()} aria-hidden="true">
      <CalaMark size={Math.max(14, px)} />
    </span>
  );
}
