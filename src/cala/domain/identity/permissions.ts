import type { Actor, Membership, Permission, Role, State } from "../model";
import { invariant } from "../shared/errors";
export const roleLabels: Record<Role, string> = {
  owner: "Propietario",
  admin: "Administrador",
  manager: "Gerente",
  front_desk: "Recepción",
  housekeeping: "Limpieza",
  finance: "Finanzas",
  viewer: "Consulta",
};
export const allPermissions: Permission[] = [
  "property.read",
  "property.write",
  "reservation.read",
  "reservation.write",
  "reservation.cancel",
  "guest.pii.read",
  "inventory.write",
  "rates.write",
  "finance.read",
  "finance.write",
  "channel.manage",
  "migration.manage",
  "team.manage",
  "audit.read",
  "operations.write",
  "automation.write",
  "report.read",
  "message.read",
  "message.write",
];
export const grants: Record<Role, Permission[]> = {
  owner: allPermissions,
  admin: allPermissions,
  manager: allPermissions,
  front_desk: [
    "property.read",
    "team.manage",
    "reservation.read",
    "reservation.write",
    "reservation.cancel",
    "message.read",
    "message.write",
    "guest.pii.read",
    "finance.read",
    "finance.write",
    "operations.write",
  ],
  housekeeping: ["property.read", "operations.write"],
  finance: [
    "property.read",
    "reservation.read",
    "guest.pii.read",
    "finance.read",
    "finance.write",
    "report.read",
  ],
  viewer: ["property.read", "reservation.read", "report.read"],
};
/** Team hierarchy: nobody manages or grants a rank equal to or above their
 *  own, except the owner, who may appoint administrators. */
export const roleRank: Record<Role, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  front_desk: 2,
  housekeeping: 1,
  finance: 1,
  viewer: 1,
};
export function canManageRole(actor: Role, target: Role) {
  if (target === "owner") return false;
  return actor === "owner" || roleRank[target] < roleRank[actor];
}
export function assignableRoles(actor: Role): Role[] {
  return (Object.keys(roleLabels) as Role[]).filter((role) =>
    canManageRole(actor, role),
  );
}
export function membership(
  s: State,
  actor: Actor,
  organizationId: string,
): Membership {
  const m = s.memberships.find(
    (m) =>
      m.userId === actor.userId &&
      m.organizationId === organizationId &&
      m.status === "active",
  );
  invariant(m, "FORBIDDEN", "No tienes acceso a esta organización.", 403);
  return m;
}
export function authorize(
  s: State,
  actor: Actor,
  organizationId: string,
  permission: Permission,
  propertyId?: string,
) {
  const m = membership(s, actor, organizationId);
  invariant(
    grants[m.role].includes(permission),
    "FORBIDDEN",
    "Tu rol no permite esta operación.",
    403,
  );
  if (propertyId) {
    const p = s.properties.find(
      (p) => p.id === propertyId && p.organizationId === organizationId,
    );
    invariant(
      p && (!m.propertyIds.length || m.propertyIds.includes(propertyId)),
      "FORBIDDEN",
      "No tienes acceso a esta propiedad.",
      403,
    );
  }
  return m;
}
export function stepUp(actor: Actor) {
  invariant(
    actor.stepUpUntil && actor.stepUpUntil > new Date().toISOString(),
    "STEP_UP_REQUIRED",
    "Confirma de nuevo tu identidad de desarrollo para realizar esta acción.",
    403,
  );
}
