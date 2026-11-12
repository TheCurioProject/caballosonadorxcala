import { expect, test } from "vitest";
import { calendarRows } from "@/cala/features/reservations/calendar-shared";

const u = (id: string, propertyId: string, name: string, parentUnitId: string | null = null) => ({
  id,
  propertyId,
  name,
  parentUnitId,
});

test("houses come first with their rooms below, website property on top", () => {
  const properties = [
    { id: "pac", name: "Casa Pacífica" },
    { id: "ccs", name: "Casa del Caballo Soñador", websiteLinked: true },
  ];
  const units = [
    u("r10", "ccs", "Room 10- Mar", "h1"),
    u("blue", "pac", "Blue Hawaii", "h2"),
    u("h2", "pac", "Casa Pacifica"),
    u("r3", "ccs", "Room 3- La Luna", "h1"),
    u("h1", "ccs", "Casa del Caballo Soñador"),
    u("r1", "ccs", "Room 1- Paso Suave", "h1"),
    u("casita", "pac", "La Casita", "h2"),
  ];
  const rows = calendarRows(units, properties);
  expect(rows.map((r) => r.unit.id)).toEqual(["h1", "r1", "r3", "r10", "h2", "blue", "casita"]);
  expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 1, 0, 1, 1]);
  expect(rows.filter((r) => r.house).map((r) => r.unit.id)).toEqual(["h1", "h2"]);
  expect(rows.filter((r) => r.lastChild).map((r) => r.unit.id)).toEqual(["r10", "casita"]);
});

test("a room whose house is filtered out stays indented in its property", () => {
  const rows = calendarRows(
    [u("r1", "p", "Room 1", "h"), u("solo", "p", "Bungalow")],
    [{ id: "p", name: "P" }],
  );
  expect(rows.map((r) => [r.unit.id, r.depth, r.house])).toEqual([
    ["solo", 0, false],
    ["r1", 1, false],
  ]);
});
