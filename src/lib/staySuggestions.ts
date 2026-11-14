/**
 * When nothing fits the dates and group a guest asked for, proposes the
 * closest stays that do fit, keeping what the guest chose as much as possible:
 * the same group always, the same number of nights first, the same weekdays
 * and weekend nights when it can, and the shortest move in the calendar.
 *
 * This module only ranks candidates from the public availability ranges. Every
 * suggestion shown to the guest is then quoted by CALA (rules, closures, rates),
 * which stays the single source of truth.
 */
import { planStay, type StayOption } from "./stayPlanner";

export type SuggestLodging = {
  id: string;
  kind: "whole_home" | "room";
  capacity: number;
  sortOrder?: number;
  minStay: number;
  maxStay: number;
  leadTimeDays: number;
  /** Last night on sale (yyyy-MM-dd), or null when open-ended. */
  openThrough: string | null;
  /** Nights that cannot be sold, inclusive ranges (yyyy-MM-dd). */
  busy: Array<{ from: string; to: string }>;
};

export type StayCandidate = {
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Days the arrival moves: negative is earlier, positive is later. */
  shiftDays: number;
  /** Nights added (+) or removed (−) from the stay the guest asked for. */
  nightsDelta: number;
  /** Lodgings free for the whole candidate stay. */
  lodgingIds: string[];
  score: number;
};

/** A candidate that CALA confirmed and priced: what the guest is offered. */
export type StaySuggestion = Pick<StayCandidate, "checkIn" | "checkOut" | "nights" | "shiftDays" | "nightsDelta"> & { option: StayOption };

const DAY = 86400000;
const time = (day: string) => Date.parse(day.slice(0, 10) + "T00:00:00Z");
export const addDays = (day: string, n: number) => new Date(time(day) + n * DAY).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(time(day)).getUTCDay();
/** Friday and Saturday nights: what makes a stay "a weekend". */
const weekendNights = (checkIn: string, nights: number) => {
  let count = 0;
  for (let i = 0; i < nights; i++) if ([5, 6].includes(weekday(addDays(checkIn, i)))) count++;
  return count;
};

export function stayCandidates(input: {
  lodgings: SuggestLodging[];
  today: string;
  checkIn: string;
  nights: number;
  adults: number;
  children: number;
  /** How far to look after / before the requested arrival. */
  forwardDays?: number;
  backwardDays?: number;
  limit?: number;
}): StayCandidate[] {
  const { lodgings, today, checkIn, nights, adults, children } = input;
  const forward = input.forwardDays ?? 120, backward = input.backwardDays ?? 30, limit = input.limit ?? 8;
  if (!lodgings.length || nights < 1 || adults < 1) return [];

  const busy = new Map<string, Set<string>>();
  for (const l of lodgings) {
    const nightsTaken = new Set<string>();
    for (const range of l.busy)
      for (let t = time(range.from), end = time(range.to), guard = 0; t <= end && guard < 1500; t += DAY, guard++)
        nightsTaken.add(new Date(t).toISOString().slice(0, 10));
    busy.set(l.id, nightsTaken);
  }
  const freeFor = (l: SuggestLodging, arrival: string, stay: number) => {
    if (stay < l.minStay || stay > l.maxStay) return false;
    if (arrival < addDays(today, l.leadTimeDays)) return false;
    if (l.openThrough && addDays(arrival, stay - 1) > l.openThrough) return false;
    const taken = busy.get(l.id)!;
    for (let i = 0; i < stay; i++) if (taken.has(addDays(arrival, i))) return false;
    return true;
  };

  const wantedWeekend = weekendNights(checkIn, nights);
  const candidates: StayCandidate[] = [];
  const consider = (shift: number, stay: number) => {
    if (stay < 1 || (shift === 0 && stay === nights)) return;
    const arrival = addDays(checkIn, shift);
    if (arrival < today) return;
    const free = lodgings.filter((l) => freeFor(l, arrival, stay));
    if (!free.length) return;
    // Same fitting rules as the real search (capacity, one adult per room, whole house alone).
    const fits = planStay(free.map((l) => ({ id: l.id, kind: l.kind, capacity: l.capacity, totalMinor: 1, sortOrder: l.sortOrder })), adults, children, 1);
    if (!fits.length) return;
    const delta = stay - nights;
    let score = Math.abs(shift) + (delta < 0 ? -delta * 4 : delta * 3);
    if (shift !== 0 && shift % 7 === 0) score -= 1.5; // same weekdays as requested
    score += Math.max(0, wantedWeekend - weekendNights(arrival, stay)) * 2; // keeps the weekend when one was chosen
    if (shift < 0) score += 0.25; // on a tie, the next opening comes first
    candidates.push({ checkIn: arrival, checkOut: addDays(arrival, stay), nights: stay, shiftDays: shift, nightsDelta: delta, lodgingIds: free.map((l) => l.id), score });
  };

  // 1) Same length of stay, moving the arrival.
  for (let shift = -backward; shift <= forward; shift++) consider(shift, nights);
  // 2) Around the same dates with one or two nights fewer or more.
  for (const delta of [-2, -1, 1, 2]) for (let shift = -3; shift <= 3; shift++) consider(shift, nights + delta);

  candidates.sort((a, b) => a.score - b.score || a.shiftDays - b.shiftDays);
  // Variety: several arrivals in the same free gap are one suggestion, not five.
  const picked: StayCandidate[] = [];
  const similar = (a: StayCandidate, b: StayCandidate) => a.nights === b.nights && Math.abs((time(a.checkIn) - time(b.checkIn)) / DAY) < 4;
  const add = (c?: StayCandidate) => {
    if (c && picked.length < limit && !picked.some((p) => similar(p, c))) picked.push(c);
  };
  add(candidates.find((c) => c.nightsDelta === 0 && c.shiftDays > 0)); // next opening with the same nights
  add(candidates.find((c) => c.nightsDelta === 0 && c.shiftDays < 0)); // closest earlier one
  add(candidates.find((c) => c.nightsDelta !== 0)); // almost the same dates, different length
  for (const c of candidates) add(c);
  return picked.sort((a, b) => a.score - b.score || a.shiftDays - b.shiftDays);
}
