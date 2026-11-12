"use client";
/**
 * Real loading progress behind CALA's fill animation.
 *
 * Every piece of work the screen is waiting on (same-origin requests, route
 * changes) is a task. Tasks that start while others are pending join the same
 * session, so progress = finished tasks + the share each pending task has
 * probably covered, over the session's total. A session ends when nothing is
 * pending; the next task opens a new one.
 *
 * A single `requestAnimationFrame` loop drives every consumer (the marks, the
 * top bar, the pressed button), so the fill is computed and painted frame by
 * frame instead of looping a CSS keyframe.
 */

let sessionId = 0;
let total = 0;
let done = 0;
let lastFinishedSession = 0;
const pending = new Map<number, number>();
let taskSeq = 0;

/** Share of a pending task assumed covered after `ms`: fast first, never 1. */
export function trickle(ms: number) {
  return 0.88 * (1 - Math.exp(-Math.max(0, ms) / 1400));
}

export function beginLoad(): () => void {
  if (pending.size === 0) {
    sessionId += 1;
    total = 0;
    done = 0;
  }
  const id = ++taskSeq;
  pending.set(id, now());
  total += 1;
  wake();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    if (!pending.delete(id)) return;
    done += 1;
    if (pending.size === 0) lastFinishedSession = sessionId;
  };
}

export interface LoadSnapshot {
  /** Session the value belongs to (0 = nothing tracked yet). */
  session: number;
  /** 0…1 progress of the session. */
  value: number;
  /** True while some task is pending. */
  active: boolean;
}

export function loadSnapshot(at = now()): LoadSnapshot {
  if (pending.size === 0)
    return {
      session: sessionId,
      value: lastFinishedSession === sessionId && sessionId > 0 ? 1 : 0,
      active: false,
    };
  let partial = 0;
  for (const startedAt of pending.values()) partial += trickle(at - startedAt);
  return {
    session: sessionId,
    value: Math.min(0.97, (done + partial) / Math.max(total, 1)),
    active: true,
  };
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/* ---------- Frame loop ---------- */

type FrameCallback = (time: number, dt: number) => void;
const frameCallbacks = new Set<FrameCallback>();
let frame = 0;
let lastTime = 0;

function tick(time: number) {
  const dt = lastTime ? Math.min(64, time - lastTime) : 16;
  lastTime = time;
  for (const callback of frameCallbacks) callback(time, dt);
  frame = frameCallbacks.size ? requestAnimationFrame(tick) : 0;
  if (!frame) lastTime = 0;
}

function wake() {
  if (!frame && frameCallbacks.size && typeof window !== "undefined")
    frame = requestAnimationFrame(tick);
}

/** Runs `callback` on every animation frame until the returned cleanup. */
export function onFrame(callback: FrameCallback) {
  frameCallbacks.add(callback);
  wake();
  return () => {
    frameCallbacks.delete(callback);
  };
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Turns the raw progress into the value a fill shows on screen:
 *  - follows the session's real progress, eased per frame and never backwards;
 *  - work started before this fill appeared (untracked) still advances with
 *    an estimate, so the fill is never stuck half way;
 *  - once the work finishes it fills to the top, holds a beat and, if the
 *    screen is still waiting, starts a new fill from the bottom.
 */
export class FillSmoother {
  value = 0;
  private session: number;
  private seenSession: number;
  private startedAt: number;
  private fullSince = 0;
  private reduced = prefersReducedMotion();

  constructor() {
    const snapshot = loadSnapshot();
    this.session = snapshot.session;
    this.seenSession = snapshot.active ? snapshot.session : -1;
    this.startedAt = now();
  }

  step(time: number, dt: number) {
    const snapshot = loadSnapshot(time);
    let target: number;
    if (snapshot.active) {
      if (snapshot.session !== this.session) {
        // New work after a finished fill: start again from the bottom.
        if (this.value >= 0.999) this.restart(time);
        this.session = snapshot.session;
      }
      this.seenSession = snapshot.session;
      target = Math.max(snapshot.value, this.estimate(time) * 0.5);
    } else if (this.seenSession === snapshot.session && snapshot.value === 1) {
      target = 1;
    } else {
      target = this.estimate(time);
    }
    target = Math.max(target, this.value);

    if (this.reduced) this.value = target;
    else {
      const tau = target >= 1 ? 70 : 220;
      this.value += (target - this.value) * (1 - Math.exp(-dt / tau));
      if (target - this.value < 0.0015) this.value = target;
    }

    if (this.value >= 0.999) {
      this.value = 1;
      this.fullSince ||= time;
      // Still on screen well after finishing: keep showing activity.
      if (time - this.fullSince > 520) {
        this.restart(time);
        this.seenSession = -1;
      }
    }
    return this.value;
  }

  private estimate(time: number) {
    return trickle(time - this.startedAt);
  }

  private restart(time: number) {
    this.value = 0;
    this.fullSince = 0;
    this.startedAt = time;
  }
}
