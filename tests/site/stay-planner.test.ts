import { expect, test } from "vitest";
import {
  customSelection,
  distributeGuests,
  planStay,
  type PlannerLodging,
} from "@/lib/stayPlanner";

const room = (id: string, capacity = 2, totalMinor = 200000, sortOrder = 0): PlannerLodging => ({ id, kind: "room", capacity, totalMinor, sortOrder });
const house: PlannerLodging = { id: "house", kind: "whole_home", capacity: 14, totalMinor: 1500000 };
const rooms = [room("r1"), room("r2"), room("r3", 2, 180000), room("r4", 4, 350000)];

test("a couple gets one room, the cheapest first, never the whole house first", () => {
  const options = planStay([...rooms, house], 2, 0);
  expect(options[0].recommended).toBe(true);
  expect(options[0].rooms).toHaveLength(1);
  expect(options[0].rooms[0].lodgingId).toBe("r3");
  expect(options.every((o) => o.rooms.every((r) => r.adults >= 1))).toBe(true);
  expect(options.at(-1)?.kind).toBe("whole_home");
});

test("five guests are split across tight room combinations only", () => {
  const options = planStay(rooms, 4, 1);
  for (const o of options) {
    expect(o.capacity).toBeGreaterThanOrEqual(5);
    // Removing any room leaves someone without a bed.
    for (const r of o.rooms) {
      const cap = rooms.find((l) => l.id === r.lodgingId)!.capacity;
      expect(o.capacity - cap).toBeLessThan(5);
    }
    expect(o.rooms.reduce((s, r) => s + r.adults + r.children, 0)).toBe(5);
  }
  expect(options[0].rooms).toHaveLength(2);
});

test("children never stay in a room without an adult", () => {
  const two = rooms.filter((r) => r.capacity === 2);
  expect(planStay(two, 1, 3)).toEqual([]);
  const options = planStay([...two, house], 1, 3);
  expect(options).toHaveLength(1);
  expect(options[0].kind).toBe("whole_home");
  expect(planStay(rooms, 1, 3)[0].rooms).toEqual([{ lodgingId: "r4", adults: 1, children: 3, totalMinor: 350000 }]);
});

test("big groups lead with the whole house and impossible groups get nothing", () => {
  const options = planStay([...rooms, house], 9, 0);
  expect(options[0].kind).toBe("whole_home");
  expect(planStay(rooms, 11, 0)).toEqual([]);
});

test("guest distribution balances free beds", () => {
  expect(distributeGuests([2, 4], 3, 2)).toEqual([
    { adults: 1, children: 1 },
    { adults: 2, children: 1 },
  ]);
  expect(distributeGuests([2, 2], 1, 1)).toBeNull();
});

test("custom selections enforce the same rules", () => {
  expect(customSelection([house, rooms[0]], 2, 0).reason).toBe("whole_with_rooms");
  expect(customSelection([rooms[0]], 3, 0).reason).toBe("capacity");
  expect(customSelection([rooms[0], rooms[1]], 1, 1).reason).toBe("adults");
  expect(customSelection([rooms[0], rooms[1], rooms[2]], 3, 0).option?.totalMinor).toBe(580000);
});
