import { test, expect } from "vitest";
import { stayCandidates, type SuggestLodging } from "@/lib/staySuggestions";

const room = (id: string, busy: Array<[string, string]> = [], extra: Partial<SuggestLodging> = {}): SuggestLodging => ({
  id, kind: "room", capacity: 2, minStay: 1, maxStay: 30, leadTimeDays: 0, openThrough: null,
  busy: busy.map(([from, to]) => ({ from, to })), ...extra,
});
const house = (busy: Array<[string, string]> = []): SuggestLodging => ({
  id: "house", kind: "whole_home", capacity: 12, minStay: 2, maxStay: 30, leadTimeDays: 0, openThrough: null,
  busy: busy.map(([from, to]) => ({ from, to })),
});
const today = "2027-01-01";

test("the next opening with the same nights comes first", () => {
  // Both rooms are taken 10–14 Jan; the guest asked for 11–13 Jan (2 nights, 2 adults).
  const lodgings = [room("a", [["2027-01-10", "2027-01-14"]]), room("b", [["2027-01-10", "2027-01-14"]])];
  const found = stayCandidates({ lodgings, today, checkIn: "2027-01-11", nights: 2, adults: 2, children: 0 });
  expect(found.length).toBeGreaterThan(0);
  // Closest free stays of 2 nights: 8–10 Jan (3 days earlier) and 15–17 Jan (4 days later).
  const sameNights = found.filter((c) => c.nightsDelta === 0);
  expect(sameNights.map((c) => c.checkIn)).toEqual(expect.arrayContaining(["2027-01-08", "2027-01-15"]));
  expect(found.every((c) => c.checkIn >= today)).toBe(true);
  // Never the stay that was just rejected, and never a stay over a taken night.
  expect(found.some((c) => c.checkIn === "2027-01-11" && c.nights === 2)).toBe(false);
  for (const c of found) for (let d = c.checkIn; d < c.checkOut; d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)) expect(d < "2027-01-10" || d > "2027-01-14").toBe(true);
});

test("a shorter stay on almost the same dates is offered next to moving the dates", () => {
  // Only the last night of a 3-night stay (12–15 Jan) is taken.
  const found = stayCandidates({ lodgings: [room("a", [["2027-01-14", "2027-01-14"]])], today, checkIn: "2027-01-12", nights: 3, adults: 2, children: 0 });
  expect(found.some((c) => c.checkIn === "2027-01-12" && c.nights === 2 && c.nightsDelta === -1)).toBe(true);
  expect(found.some((c) => c.nightsDelta === 0)).toBe(true);
});

test("suggestions respect the group: enough beds and one adult per room", () => {
  // Six adults need three rooms; on the requested dates only two are free.
  const lodgings = [room("a"), room("b"), room("c", [["2027-02-01", "2027-02-10"]])];
  const found = stayCandidates({ lodgings, today, checkIn: "2027-02-03", nights: 2, adults: 6, children: 0 });
  expect(found.length).toBeGreaterThan(0);
  for (const c of found) expect(c.lodgingIds).toEqual(["a", "b", "c"]);
  // One adult with three children cannot be split across double rooms: only the house fits.
  const family = stayCandidates({ lodgings: [...lodgings, house([["2027-02-01", "2027-02-05"]])], today, checkIn: "2027-02-03", nights: 2, adults: 1, children: 3 });
  expect(family.length).toBeGreaterThan(0);
  for (const c of family) expect(c.lodgingIds).toContain("house");
});

test("weekend stays stay on a weekend and rules of each lodging are respected", () => {
  // Friday 15 – Sunday 17 Jan 2027 is taken; the following weekend is free.
  const lodgings = [room("a", [["2027-01-13", "2027-01-18"]], { minStay: 2, leadTimeDays: 2, openThrough: "2027-03-31" })];
  const found = stayCandidates({ lodgings, today, checkIn: "2027-01-15", nights: 2, adults: 2, children: 0 });
  // Same weekdays one week later rank ahead of a mid-week stay that is only a few days away.
  expect(found[0]).toMatchObject({ checkIn: "2027-01-22", shiftDays: 7, nightsDelta: 0 });
  // Minimum stay, advance notice and the end of the sales window are never broken.
  expect(found.every((c) => c.nights >= 2 && c.checkIn >= "2027-01-03" && c.checkOut <= "2027-04-01")).toBe(true);
});

test("nothing is suggested when no stay can fit the group", () => {
  expect(stayCandidates({ lodgings: [room("a")], today, checkIn: "2027-01-11", nights: 2, adults: 5, children: 0 })).toEqual([]);
  expect(stayCandidates({ lodgings: [], today, checkIn: "2027-01-11", nights: 2, adults: 2, children: 0 })).toEqual([]);
});
