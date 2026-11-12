"use client";
/**
 * CALA's loading mark: the isotype outline is traced while a tide fills the
 * cove. Colors follow `currentColor` (the theme accent by default), so it
 * works in every CALA theme and inside the Casa Caballo Soñador modules.
 */
import { useEffect, useId, useState } from "react";
import { useOptionalT } from "@/cala/lib/i18n";

const ISOTYPE =
  "M318 72 C236 62 153 83 98 135 C44 186 34 263 59 328 C87 402 157 445 233 437 C291 431 347 405 390 365 C427 330 454 285 461 239 C467 200 446 164 411 153 C381 144 354 155 329 178 L268 235 C244 258 210 270 181 256 C146 240 135 196 158 165 C177 139 210 127 245 128 C283 130 314 111 328 82 C333 72 328 73 318 72 Z M398 235 C393 272 370 307 340 335 C309 363 271 381 234 386 C188 392 146 367 128 326 C116 299 117 269 130 246 C140 270 157 288 180 299 C224 320 274 305 311 270 L365 220 C377 209 391 212 398 222 C400 225 400 231 398 235 Z";
// One wave period is 226 units; the band is wide enough to loop seamlessly.
const WAVE = `M-428 0 q56.5 -24 113 0${" t113 0".repeat(13)} V520 H-428 Z`;

export function CalaMark({
  size = 48,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = "cala-mark-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      aria-hidden="true"
      className={`cala-mark ${className}`.trim()}
      focusable="false"
      height={Math.round((size * 400) / 452)}
      viewBox="24 52 452 400"
      width={size}
    >
      <defs>
        <clipPath id={id}>
          <path clipRule="evenodd" d={ISOTYPE} />
        </clipPath>
      </defs>
      <path className="cala-mark-base" d={ISOTYPE} fillRule="evenodd" />
      <g clipPath={`url(#${id})`}>
        <g className="cala-mark-tide">
          <path className="cala-mark-wave" d={WAVE} />
        </g>
      </g>
      <path className="cala-mark-trace" d={ISOTYPE} pathLength={100} />
    </svg>
  );
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
