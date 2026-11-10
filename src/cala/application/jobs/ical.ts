import type { Context } from "../context";
import type { Job } from "@/cala/domain/model";
import { parseCalendar } from "@/cala/domain/distribution/ical";
import { event } from "../context";
import { inventoryCommand } from "../commands/inventory";
export function importCalendar(c: Context, j: Job) {
  const events = parseCalendar(String(j.payload.content));
  c.state.icalEvents ??= [];
  let applied = 0,
    skipped = 0;
  for (const e of events) {
    if (e.own) {
      skipped++;
      continue;
    }
    const calendar = String(j.payload.calendar),
      unitId = String(j.payload.unitId);
    const old = c.state.icalEvents.find(
      (x) =>
        x.propertyId === j.propertyId &&
        x.unitId === unitId &&
        x.calendar === calendar &&
        x.uid === e.uid,
    );
    if (
      old &&
      (e.sequence < old.sequence ||
        (e.sequence === old.sequence && e.stamp <= old.stamp))
    ) {
      skipped++;
      continue;
    }
    const block = old && c.state.blocks.find((b) => b.id === old.blockId);
    if (block) {
      block.active = false;
      event(c, j.organizationId, j.propertyId, "inventory.changed", block.id);
    }
    let blockId = old?.blockId ?? "";
    if (!e.cancelled) {
      blockId = inventoryCommand(c, {
        type: "block.create",
        organizationId: j.organizationId,
        propertyId: j.propertyId,
        unitId,
        arrival: e.arrival,
        departure: e.departure,
        reason: "Bloqueo importado desde iCal",
      })!.id;
    }
    if (old)
      Object.assign(old, { sequence: e.sequence, stamp: e.stamp, blockId });
    else
      c.state.icalEvents.push({
        propertyId: j.propertyId,
        unitId,
        calendar,
        uid: e.uid,
        sequence: e.sequence,
        stamp: e.stamp,
        blockId,
      });
    applied++;
  }
  j.result = [
    `${applied} eventos aplicados; ${skipped} omitidos por dedupe o procedencia propia.`,
    "Los eventos ausentes del archivo no se eliminan; una cancelación debe ser explícita.",
  ];
}
