import { randomUUID } from "node:crypto";
import type {
  Actor,
  CommandResult,
  Permission,
  State,
} from "@/cala/domain/model";
import { authorize } from "@/cala/domain/identity/permissions";
import { invariant } from "@/cala/domain/shared/errors";
export interface Context {
  state: State;
  actor: Actor;
  requestId: string;
  now: string;
  id: () => string;
}
export function context(
  state: State,
  actor: Actor,
  requestId: string,
): Context {
  return {
    state,
    actor,
    requestId,
    now: new Date().toISOString(),
    id: randomUUID,
  };
}
export function permit(
  c: Context,
  org: string,
  p: Permission,
  property?: string,
) {
  return authorize(c.state, c.actor, org, p, property);
}
export function audit(
  c: Context,
  organizationId: string,
  propertyId: string | null,
  action: string,
  entityId: string,
  detail = "Operación realizada",
) {
  c.state.audits.push({
    id: c.id(),
    organizationId,
    propertyId,
    actorId: c.actor.userId,
    action,
    entityId,
    requestId: c.requestId,
    createdAt: c.now,
    detail,
  });
}
export function event(
  c: Context,
  organizationId: string,
  propertyId: string,
  type: string,
  entityId: string,
) {
  c.state.outbox.push({
    id: c.id(),
    organizationId,
    propertyId,
    type,
    entityId,
    createdAt: c.now,
    processedAt: null,
  });
}
export function checkVersion(actual: number, expected: number | undefined) {
  invariant(
    actual === expected,
    "VERSION_CONFLICT",
    "Otra persona actualizó este registro. Recarga antes de guardar.",
    409,
  );
}
export function result(
  id: string,
  message = "Cambios guardados",
): CommandResult {
  return { id, message };
}
