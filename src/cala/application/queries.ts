import { jobPermission } from "@/cala/domain/identity/job-permissions";
import type {
  Actor,
  Reservation,
  ReservationTrashEntry,
  Snapshot,
  State,
} from "@/cala/domain/model";
import { authorize, grants } from "@/cala/domain/identity/permissions";
import { invariant } from "@/cala/domain/shared/errors";
import { today } from "@/cala/domain/shared/dates";
export function snapshot(
  s: State,
  actor: Actor,
  organizationId?: string,
  propertyId?: string,
): Snapshot {
  const memberships = s.memberships.filter(
    (m) => m.userId === actor.userId && m.status === "active",
  );
  const org = organizationId ?? memberships[0]?.organizationId;
  invariant(
    org,
    "NO_ORGANIZATION",
    "Crea una organización para continuar.",
    409,
  );
  const m = authorize(s, actor, org, "property.read");
  const permissions = grants[m.role];
  const allowedProperties = s.properties.filter(
    (p) =>
      p.organizationId === org &&
      (!m.propertyIds.length || m.propertyIds.includes(p.id)),
  );
  const pId = propertyId ?? allowedProperties[0]?.id ?? "";
  if (pId) authorize(s, actor, org, "property.read", pId);
  const has = (p: (typeof permissions)[number]) => permissions.includes(p);
  const properties = allowedProperties;
  const propIds = new Set(properties.map((p) => p.id));
  const trash = trashedReservations(s.reservationTrash ?? [], s.reservations);
  const visibleTrash = trash.filter((t) => propIds.has(t.propertyId));
  const relevantReservations = s.reservations.filter(
    (r) => propIds.has(r.propertyId) && !trash.some((t) => t.reservationId === r.id),
  );
  const trashIds = new Set(trash.map((t) => t.reservationId));
  const guestIds = new Set(
    [...relevantReservations, ...visibleTrash.flatMap((t) => t.reservation ?? [])].map(
      (r) => r.guestId,
    ),
  );
  const guests = has("guest.pii.read")
    ? s.guests.filter(
        (g) =>
          g.organizationId === org &&
          (!m.propertyIds.length ||
            guestIds.has(g.id) ||
            s.audits.some(
              (a) => a.entityId === g.id && a.actorId === actor.userId,
            )),
      )
    : [];
  const currentUser = s.users.find((u) => u.id === actor.userId)!;
  const team = s.memberships.filter((x) => x.organizationId === org);
  return {
    workspacePreferences: (s.workspacePreferences ?? []).filter(
      (p) => p.organizationId === org && p.userId === actor.userId,
    ),
    conversations:
      has("message.read") && has("guest.pii.read")
        ? s.conversations.filter((x) => propIds.has(x.propertyId))
        : [],
    messageEntries:
      has("message.read") && has("guest.pii.read")
        ? s.messageEntries.filter((x) => propIds.has(x.propertyId))
        : [],
    messageTemplates: has("message.read")
      ? s.messageTemplates.filter((x) => propIds.has(x.propertyId))
      : [],
    marketObservations: has("report.read")
      ? s.marketObservations.filter((x) => propIds.has(x.propertyId))
      : [],
    schemaVersion: 2,
    organizations: s.organizations.filter((o) =>
      memberships.some((m) => m.organizationId === o.id),
    ),
    users: s.users
      .filter(
        (u) =>
          u.id === actor.userId ||
          ((has("team.manage") || has("operations.write")) &&
            team.some((m) => m.userId === u.id)),
      )
      .map((u) =>
        has("team.manage") || u.id === actor.userId ? u : { ...u, email: "" },
      ),
    memberships: has("team.manage") ? team : [m],
    properties,
    inventoryTypes: s.inventoryTypes.filter((x) => propIds.has(x.propertyId)),
    units: s.units.filter((x) => propIds.has(x.propertyId)),
    guests,
    reservations: has("reservation.read")
      ? relevantReservations.map((r) => ({
          ...r,
          notes: has("guest.pii.read") ? r.notes : "",
          totalMinor: has("finance.read") ? r.totalMinor : 0,
        }))
      : [],
    reservationTrash: has("reservation.read")
      ? visibleTrash.map((t) => ({
          ...t,
          reservation: t.reservation && {
            ...t.reservation,
            notes: has("guest.pii.read") ? t.reservation.notes : "",
            totalMinor: has("finance.read") ? t.reservation.totalMinor : 0,
          },
        }))
      : [],
    blocks: s.blocks.filter((x) => propIds.has(x.propertyId)),
    ratePlans: s.ratePlans.filter((x) => propIds.has(x.propertyId)),
    rateDays: s.rateDays.filter((x) => propIds.has(x.propertyId)),
    folioItems: has("finance.read")
      ? s.folioItems.filter(
          (x) => propIds.has(x.propertyId) && !trashIds.has(x.reservationId),
        )
      : [],
    payments: has("finance.read")
      ? s.payments.filter(
          (x) => propIds.has(x.propertyId) && !trashIds.has(x.reservationId),
        )
      : [],
    tasks: s.tasks.filter((x) => propIds.has(x.propertyId)),
    channels: has("channel.manage")
      ? s.channels.filter((x) => propIds.has(x.propertyId))
      : [],
    jobs: s.jobs.filter(
      (x) => propIds.has(x.propertyId) && has(jobPermission(x.type)),
    ),
    audits: has("audit.read")
      ? s.audits.filter(
          (x) =>
            x.organizationId === org &&
            (!x.propertyId || propIds.has(x.propertyId)),
        )
      : [],
    outbox: [],
    automations: has("automation.write")
      ? s.automations.filter((x) => propIds.has(x.propertyId))
      : [],
    drafts: s.drafts.filter(
      (d) => d.organizationId === org && d.userId === actor.userId,
    ),
    currentUser,
    permissions,
    currentOrganizationId: org,
    currentPropertyId: pId,
    development: true,
    today: today(properties.find((p) => p.id === pId)?.timezone),
  };
}

/**
 * Stays in the trash, each with its reservation. A stay that something else
 * revived (no longer cancelled / no-show, e.g. a website checkout paid late)
 * is not trashed anymore, even before the database cleans its trash row.
 */
export function trashedReservations(
  trash: ReservationTrashEntry[],
  reservations: Reservation[],
): ReservationTrashEntry[] {
  return trash.flatMap((t) => {
    const reservation = reservations.find((r) => r.id === t.reservationId);
    return reservation && ["cancelled", "no_show"].includes(reservation.status)
      ? [{ ...t, reservation }]
      : [];
  });
}
