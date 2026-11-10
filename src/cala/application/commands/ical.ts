import { createHash, randomBytes } from "node:crypto";
import type { Command } from "../schemas";
import type { Context } from "../context";
import { permit, audit, result } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { enqueue } from "./jobs";
import { parseCalendar } from "@/cala/domain/distribution/ical";
export function icalCommand(c: Context, cmd: Command) {
  if (
    cmd.type !== "ical.rotate" &&
    cmd.type !== "ical.revoke" &&
    cmd.type !== "ical.import"
  )
    return;
  permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
  invariant(
    c.state.units.some(
      (u) =>
        u.id === cmd.unitId &&
        u.propertyId === cmd.propertyId &&
        u.active &&
        c.state.inventoryTypes.some(
          (t) => t.id === u.inventoryTypeId && t.active,
        ),
    ),
    "INVALID_UNIT",
    "Unidad no válida.",
  );
  if (cmd.type === "ical.import") {
    parseCalendar(cmd.content);
    permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
    const id = enqueue(c, {
      organizationId: cmd.organizationId,
      propertyId: cmd.propertyId,
      type: "ical_import",
      payload: {
        unitId: cmd.unitId,
        calendar: cmd.calendar,
        content: cmd.content,
      },
    });
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
    return result(id, "Importación iCal en cola");
  }
  c.state.icalFeeds = (c.state.icalFeeds ?? []).filter(
    (f) => f.unitId !== cmd.unitId,
  );
  audit(c, cmd.organizationId, cmd.propertyId, cmd.type, cmd.unitId);
  if (cmd.type === "ical.revoke") return result(cmd.unitId, "Enlace revocado");
  const token = randomBytes(32).toString("hex");
  c.state.icalFeeds.push({
    propertyId: cmd.propertyId,
    unitId: cmd.unitId,
    actorId: c.actor.userId,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  });
  return {
    ...result(
      cmd.unitId,
      "Enlace privado creado. El anterior dejó de funcionar.",
    ),
    secretUrl: "/api/ical?token=" + token,
  };
}
