import { createHash } from "node:crypto";
import { z } from "zod";
import type { State } from "@/cala/domain/model";
import { authorize } from "@/cala/domain/identity/permissions";
import { unitsConflict } from "@/cala/domain/inventory/availability";
import { addDays, isDate, overlaps, today } from "@/cala/domain/shared/dates";
import { invariant } from "@/cala/domain/shared/errors";

const date = z.string().refine(isDate);
export const publicCalendarSchema = z.object({
  today: date,
  coverageStart: date,
  coverageEnd: date,
  events: z
    .array(
      z.object({
        uid: z.string().regex(/^[a-f0-9]{64}@cala\.local$/),
        arrival: date,
        departure: date,
        sequence: z.number().int().nonnegative(),
        cancelled: z.boolean(),
        exportable: z.boolean(),
      }),
    )
    .max(4000),
});
export type PublicCalendar = z.infer<typeof publicCalendarSchema>;
export const calendarToken = /^[a-f0-9]{64}$/;

/** Capability-scoped DTO. Never return names, room IDs, reasons or financial data. */
export function readPublicCalendar(
  state: State,
  token: string,
): PublicCalendar {
  invariant(
    calendarToken.test(token),
    "NOT_FOUND",
    "Enlace no disponible.",
    404,
  );
  const hash = createHash("sha256").update(token).digest("hex");
  const feed = state.icalFeeds?.find((f) => f.tokenHash === hash);
  const unit = state.units.find(
    (u) =>
      u.id === feed?.unitId && u.propertyId === feed.propertyId && u.active,
  );
  const property = state.properties.find((p) => p.id === unit?.propertyId);
  invariant(
    feed &&
      unit &&
      property &&
      state.inventoryTypes.some(
        (t) => t.id === unit.inventoryTypeId && t.active,
      ),
    "NOT_FOUND",
    "Enlace no disponible.",
    404,
  );
  try {
    authorize(
      state,
      { userId: feed.actorId, stepUpUntil: null },
      property.organizationId,
      "channel.manage",
      property.id,
    );
  } catch {
    invariant(false, "NOT_FOUND", "Enlace no disponible.", 404);
  }
  const current = today(property.timezone),
    coverageStart = addDays(current, -730),
    coverageEnd = addDays(current, 731);
  const uid = (id: string) =>
    createHash("sha256").update(`${hash}:${id}`).digest("hex") + "@cala.local";
  const events: PublicCalendar["events"] = state.reservations
    .filter(
      (r) =>
        r.propertyId === property.id &&
        r.status !== "draft" &&
        overlaps(coverageStart, coverageEnd, r.arrival, r.departure) &&
        (r.unitId
          ? unitsConflict(state, unit.id, r.unitId)
          : state.units.some(
              (possible) =>
                possible.inventoryTypeId === r.inventoryTypeId &&
                unitsConflict(state, unit.id, possible.id),
            )),
    )
    .map((r) => ({
      uid: uid(r.id),
      arrival: r.arrival,
      departure: r.departure,
      sequence: r.version,
      cancelled: ["cancelled", "no_show"].includes(r.status),
      exportable: true,
    }));
  const imported = new Set(
    (state.icalEvents ?? []).map((event) => event.blockId),
  );
  for (const b of state.blocks.filter(
    (b) =>
      b.propertyId === property.id &&
      overlaps(coverageStart, coverageEnd, b.arrival, b.departure) &&
      unitsConflict(state, unit.id, b.unitId),
  )) {
    events.push({
      uid: uid(b.id),
      arrival: b.arrival,
      departure: b.departure,
      sequence: b.active ? 1 : 2,
      cancelled: !b.active,
      exportable: !imported.has(b.id),
    });
  }
  return publicCalendarSchema.parse({
    today: current,
    coverageStart,
    coverageEnd,
    events,
  });
}
