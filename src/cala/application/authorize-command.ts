import type { Actor, Permission, State } from "@/cala/domain/model";
import { authorize } from "@/cala/domain/identity/permissions";
import { jobPermission } from "@/cala/domain/identity/job-permissions";
import { invariant } from "@/cala/domain/shared/errors";
import type { Command } from "./schemas";
/** Recheck current scope/permission even when returning a cached idempotent result. */
export function authorizeCommand(state: State, actor: Actor, cmd: Command) {
  if (cmd.type === "organization.create") return;
  const permissions: Partial<Record<Command["type"], Permission>> = {
    "workspace.preferences.save": "property.read",
    "message.save": "message.write",
    "message.cancel": "message.write",
    "conversation.update": "message.write",
    "template.save": "message.write",
    "template.delete": "message.write",
    "market.import": "rates.write",
    "onboarding.save": "property.write",
    "property.create": "property.write",
    "property.update": "property.write",
    "guest.save": "reservation.write",
    "inventory.create": "inventory.write",
    "unit.create": "inventory.write",
    "inventory.update": "inventory.write",
    "unit.update": "inventory.write",
    "block.create": "inventory.write",
    "block.release": "inventory.write",
    "reservation.save": "reservation.write",
    "reservation.move": "reservation.write",
    "reservation.transition": "reservation.write",
    "rates.bulk": "rates.write",
    "ratePlan.create": "rates.write",
    "task.save": "operations.write",
    "unit.clean": "operations.write",
    "folio.charge": "finance.write",
    "payment.create": "finance.write",
    "team.update": "team.manage",
    "team.invite": "team.manage",
    "team.remove": "team.manage",
    "channel.create": "channel.manage",
    "channel.update": "channel.manage",
    "channel.sync": "channel.manage",
    "channel.connect": "channel.manage",
    "channel.disconnect": "channel.manage",
    "migration.start": "migration.manage",
    "migration.review": "migration.manage",
    "automation.save": "automation.write",
    "report.generate": "report.read",
    "ical.rotate": "channel.manage",
    "ical.revoke": "channel.manage",
    "ical.import": "channel.manage",
  };
  let permission = permissions[cmd.type];
  if (cmd.type === "reservation.transition" && cmd.status === "cancelled")
    permission = "reservation.cancel";
  if (cmd.type === "job.retry") {
    const job = state.jobs.find(
      (j) => j.id === cmd.id && j.propertyId === cmd.propertyId,
    );
    invariant(job, "NOT_FOUND", "Proceso no encontrado.", 404);
    permission = jobPermission(job.type);
  }
  invariant(permission, "UNKNOWN_COMMAND", "Acción no disponible.");
  authorize(
    state,
    actor,
    cmd.organizationId,
    permission,
    "propertyId" in cmd ? cmd.propertyId : undefined,
  );
}
