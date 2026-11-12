/**
 * Recommends how to accommodate a group across the lodgings CALA can sell for
 * a stay. Availability, prices and every booking rule (lead time, minimum and
 * maximum stay, closures, CTA/CTD, inventory) are decided by CALA's quote;
 * this module only receives the lodgings that quoted successfully and decides
 * which combinations fit the group, using each lodging's maximum occupancy.
 *
 * Rules:
 * - Rooms can be combined; the whole house already contains every room, so it
 *   is never combined with rooms.
 * - Every room needs at least one adult (children never stay alone).
 * - Only "tight" combinations are offered: removing any room would leave
 *   someone without a bed, so the guest never pays for an unnecessary room.
 */
export type PlannerLodging = {
  id: string;
  kind: "whole_home" | "room";
  capacity: number;
  totalMinor: number;
  sortOrder?: number;
};
export type PlannedRoom = {
  lodgingId: string;
  adults: number;
  children: number;
  totalMinor: number;
};
export type StayOption = {
  id: string;
  kind: "rooms" | "whole_home";
  rooms: PlannedRoom[];
  totalMinor: number;
  capacity: number;
  spareBeds: number;
  recommended: boolean;
};

const MAX_ROOMS_TO_COMBINE = 14;

/** Spreads the group across rooms: one adult per room first, then everyone else
 * goes to the room with the most free beds so occupancy stays balanced. Returns
 * null when the rooms cannot hold the group. */
export function distributeGuests(
  capacities: number[],
  adults: number,
  children: number,
): Array<{ adults: number; children: number }> | null {
  const rooms = capacities.map(() => ({ adults: 0, children: 0 }));
  const total = capacities.reduce((s, c) => s + c, 0);
  if (
    !rooms.length ||
    adults < rooms.length ||
    adults + children > total ||
    capacities.some((c) => c < 1)
  )
    return null;
  rooms.forEach((r) => (r.adults = 1));
  const free = (i: number) =>
    capacities[i] - rooms[i].adults - rooms[i].children;
  const place = (key: "adults" | "children", count: number) => {
    for (let n = 0; n < count; n++) {
      let best = -1;
      for (let i = 0; i < rooms.length; i++)
        if (free(i) > 0 && (best < 0 || free(i) > free(best))) best = i;
      if (best < 0) return false;
      rooms[best][key]++;
    }
    return true;
  };
  if (!place("adults", adults - rooms.length) || !place("children", children))
    return null;
  return rooms;
}

function option(
  kind: StayOption["kind"],
  lodgings: PlannerLodging[],
  adults: number,
  children: number,
): StayOption | null {
  const split = distributeGuests(
    lodgings.map((l) => l.capacity),
    adults,
    children,
  );
  if (!split) return null;
  const capacity = lodgings.reduce((s, l) => s + l.capacity, 0);
  return {
    id: kind + ":" + lodgings.map((l) => l.id).sort().join("+"),
    kind,
    rooms: lodgings.map((l, i) => ({
      lodgingId: l.id,
      ...split[i],
      totalMinor: l.totalMinor,
    })),
    totalMinor: lodgings.reduce((s, l) => s + l.totalMinor, 0),
    capacity,
    spareBeds: capacity - adults - children,
    recommended: false,
  };
}

export function planStay(
  available: PlannerLodging[],
  adults: number,
  children: number,
  maxOptions = 4,
): StayOption[] {
  const guests = adults + children;
  if (adults < 1 || children < 0 || !Number.isInteger(adults + children))
    return [];
  const rooms = available
    .filter((l) => l.kind === "room" && l.capacity > 0)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id),
    )
    .slice(0, MAX_ROOMS_TO_COMBINE);
  const combos: StayOption[] = [];
  for (let mask = 1; mask < 1 << rooms.length; mask++) {
    const chosen = rooms.filter((_, i) => mask & (1 << i));
    if (chosen.length > adults) continue;
    const capacity = chosen.reduce((s, l) => s + l.capacity, 0);
    if (capacity < guests) continue;
    // Tight: every room is needed to fit the group.
    if (chosen.some((l) => capacity - l.capacity >= guests)) continue;
    const planned = option("rooms", chosen, adults, children);
    if (planned) combos.push(planned);
  }
  combos.sort(
    (a, b) =>
      a.rooms.length - b.rooms.length ||
      a.totalMinor - b.totalMinor ||
      a.spareBeds - b.spareBeds,
  );
  const picked: StayOption[] = [];
  const add = (o?: StayOption | null) => {
    if (o && !picked.some((p) => p.id === o.id)) picked.push(o);
  };
  // 1) Fewest rooms, cheapest. 2) Cheapest overall. 3) Next alternatives.
  add(combos[0]);
  add([...combos].sort((a, b) => a.totalMinor - b.totalMinor)[0]);
  for (const c of combos) {
    if (picked.length >= maxOptions - 1) break;
    add(c);
  }
  const whole = available.find((l) => l.kind === "whole_home");
  const house = whole ? option("whole_home", [whole], adults, children) : null;
  if (house) {
    const best = picked[0];
    // Large groups (needing most of the rooms) or a cheaper house: lead with it.
    const lead =
      !best ||
      house.totalMinor <= best.totalMinor ||
      best.rooms.length >= Math.max(2, rooms.length - 1);
    if (lead) picked.unshift(house);
    else picked.push(house);
  }
  const result = picked.slice(0, maxOptions);
  if (result[0]) result[0].recommended = true;
  return result;
}

/** Validates a guest-made selection with the same rules as the planner. */
export function customSelection(
  lodgings: PlannerLodging[],
  adults: number,
  children: number,
): { option: StayOption | null; reason: "" | "empty" | "whole_with_rooms" | "capacity" | "adults" } {
  if (!lodgings.length) return { option: null, reason: "empty" };
  if (lodgings.length > 1 && lodgings.some((l) => l.kind === "whole_home"))
    return { option: null, reason: "whole_with_rooms" };
  const capacity = lodgings.reduce((s, l) => s + l.capacity, 0);
  if (capacity < adults + children) return { option: null, reason: "capacity" };
  if (lodgings.length > adults) return { option: null, reason: "adults" };
  const kind = lodgings[0].kind === "whole_home" ? "whole_home" : "rooms";
  return { option: option(kind, lodgings, adults, children), reason: "" };
}
