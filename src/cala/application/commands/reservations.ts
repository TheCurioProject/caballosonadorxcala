import type { Command } from "../schemas";
import type { Context } from "../context";
import type { Reservation, ReservationStatus } from "@/cala/domain/model";
import { permit, audit, result, checkVersion, event } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { assertInventory } from "@/cala/domain/inventory/availability";
import { priceStay } from "@/cala/domain/reservations/pricing";
import { membership } from "@/cala/domain/identity/permissions";
import { nights } from "@/cala/domain/shared/dates";
const transitions: Record<ReservationStatus, ReservationStatus[]> = {
  draft: ["confirmed", "cancelled"],
  pending: ["confirmed", "cancelled", "no_show"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};
const TRASH_DAYS = 10;
/** Deletes a stay and everything that only exists because of it (guest profile and audit trail stay). */
function purgeReservation(s: Context["state"], id: string) {
  s.reservations = s.reservations.filter((r) => r.id !== id);
  s.reservationTrash = (s.reservationTrash ?? []).filter(
    (t) => t.reservationId !== id,
  );
  s.folioItems = s.folioItems.filter((i) => i.reservationId !== id);
  s.payments = s.payments.filter((p) => p.reservationId !== id);
  s.conversations = s.conversations.filter((x) => x.reservationId !== id);
  s.messageEntries = s.messageEntries.filter((x) => x.reservationId !== id);
}
/** Empties what is due; a stay revived meanwhile simply leaves the trash. */
export function purgeDueTrash(s: Context["state"], now: string) {
  const live = (id: string) =>
    ["cancelled", "no_show"].includes(
      s.reservations.find((r) => r.id === id)?.status ?? "cancelled",
    );
  s.reservationTrash = (s.reservationTrash ?? []).filter((t) =>
    live(t.reservationId),
  );
  for (const t of [...s.reservationTrash])
    if (t.purgeAfter <= now) purgeReservation(s, t.reservationId);
}
function trashCommand(c: Context, cmd: Command) {
  if (
    cmd.type !== "reservation.delete" &&
    cmd.type !== "reservation.restore" &&
    cmd.type !== "reservation.purge"
  )
    return;
  const s = c.state;
  permit(c, cmd.organizationId, "reservation.cancel", cmd.propertyId);
  purgeDueTrash(s, c.now);
  s.reservationTrash ??= [];
  const r = s.reservations.find(
    (r) =>
      r.id === cmd.id &&
      r.propertyId === cmd.propertyId &&
      r.organizationId === cmd.organizationId,
  );
  invariant(r, "NOT_FOUND", "Reserva no encontrada.", 404);
  const entry = s.reservationTrash.find((t) => t.reservationId === r.id);
  if (cmd.type === "reservation.delete") {
    invariant(
      !entry,
      "ALREADY_IN_TRASH",
      "Esta reserva ya está en la papelera.",
      409,
    );
    if (cmd.version !== undefined) checkVersion(r.version, cmd.version);
    s.reservationTrash.push({
      reservationId: r.id,
      organizationId: r.organizationId,
      propertyId: r.propertyId,
      previousStatus: r.status,
      deletedAt: c.now,
      purgeAfter: new Date(
        Date.parse(c.now) + TRASH_DAYS * 86_400_000,
      ).toISOString(),
      deletedBy: c.actor.userId,
    });
    if (!["cancelled", "no_show"].includes(r.status)) {
      r.status = "cancelled";
      r.version++;
    }
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, r.id, "Enviada a la papelera");
    return result(
      r.id,
      "Reserva enviada a la papelera. Puedes recuperarla durante 10 días.",
    );
  }
  invariant(
    entry,
    "NOT_IN_TRASH",
    "La reserva ya no está en la papelera.",
    409,
  );
  if (cmd.type === "reservation.purge") {
    purgeReservation(s, r.id);
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, r.id, "Borrada definitivamente");
    return result(r.id, "Reserva borrada definitivamente.");
  }
  if (r.status === "cancelled" && entry.previousStatus !== "cancelled")
    assertInventory(s, { ...r, status: entry.previousStatus });
  s.reservationTrash = s.reservationTrash.filter((t) => t !== entry);
  if (r.status === "cancelled" && entry.previousStatus !== "cancelled") {
    r.status = entry.previousStatus;
    r.version++;
  }
  audit(c, cmd.organizationId, cmd.propertyId, cmd.type, r.id, "Recuperada de la papelera");
  return result(r.id, "Reserva recuperada.");
}
export function reservationCommand(c: Context, cmd: Command) {
  const s = c.state;
  const trashed = trashCommand(c, cmd);
  if (trashed) return trashed;
  if (
    cmd.type === "reservation.save" ||
    cmd.type === "reservation.move" ||
    cmd.type === "reservation.transition"
  )
    invariant(
      !cmd.id || !s.reservationTrash?.some((t) => t.reservationId === cmd.id),
      "RESERVATION_IN_TRASH",
      "Esta reserva está en la papelera. Recupérala para editarla.",
      409,
    );
  if (cmd.type === "reservation.move") {
    permit(c, cmd.organizationId, "reservation.write", cmd.propertyId);
    const r = s.reservations.find(
      (r) =>
        r.id === cmd.id &&
        r.propertyId === cmd.propertyId &&
        r.organizationId === cmd.organizationId,
    );
    invariant(r, "NOT_FOUND", "Reserva no encontrada.", 404);
    checkVersion(r.version, cmd.version);
    invariant(
      ["pending", "confirmed", "checked_in"].includes(r.status),
      "INVALID_TRANSITION",
      "Esta estancia ya no se puede mover.",
      409,
    );
    invariant(
      r.status !== "checked_in" ||
        (r.arrival === cmd.arrival && r.departure === cmd.departure),
      "IN_HOUSE_DATES",
      "Una estancia en casa solo puede cambiar de unidad, conservando las fechas.",
    );
    const unit = s.units.find(
      (u) => u.id === cmd.unitId && u.propertyId === cmd.propertyId && u.active,
    );
    invariant(
      unit,
      "INVALID_UNIT",
      "Selecciona una unidad activa de esta propiedad.",
    );
    invariant(
      r.unitId !== unit.id ||
        r.arrival !== cmd.arrival ||
        r.departure !== cmd.departure,
      "NO_CHANGE",
      "La estancia ya está en esa unidad y esas fechas.",
    );
    invariant(
      r.status !== "checked_in" || unit.housekeeping !== "dirty",
      "ROOM_NOT_READY",
      "La unidad necesita limpieza antes del traslado.",
      409,
    );
    invariant(
      nights(cmd.arrival, cmd.departure).length ===
        nights(r.arrival, r.departure).length,
      "STAY_DURATION",
      "Un traslado conserva el número de noches. Usa la edición de reserva para cambiar la duración.",
    );
    const next = {
      ...r,
      unitId: unit.id,
      inventoryTypeId: unit.inventoryTypeId,
      arrival: cmd.arrival,
      departure: cmd.departure,
    };
    assertInventory(s, next);
    if (cmd.pricing === "recalculate") {
      permit(c, cmd.organizationId, "finance.write", cmd.propertyId);
      next.totalMinor = priceStay(
        s,
        r.propertyId,
        next.inventoryTypeId,
        r.ratePlanId,
        next.arrival,
        next.departure,
      ).totalMinor;
    }
    const before = `${r.unitId ?? "sin asignar"} · ${r.arrival}/${r.departure}`;
    if (r.status === "checked_in" && r.unitId && r.unitId !== unit.id) {
      const previous = s.units.find((u) => u.id === r.unitId)!;
      previous.housekeeping = "dirty";
      previous.version++;
    }
    Object.assign(r, next, { version: r.version + 1 });
    if (cmd.pricing === "recalculate") {
      const room = s.folioItems.find(
        (i) => i.reservationId === r.id && i.kind === "room",
      );
      invariant(
        room,
        "FOLIO_MISSING",
        "No se encontró el cargo de alojamiento; revisa el folio antes de recalcular.",
        409,
      );
      room.amountMinor = r.totalMinor;
      room.description = `Alojamiento · ${cmd.arrival} / ${cmd.departure}`;
    }
    audit(
      c,
      cmd.organizationId,
      cmd.propertyId,
      cmd.type,
      r.id,
      `${before} → ${unit.id} · ${r.arrival}/${r.departure} · ${cmd.pricing}`,
    );
    event(c, cmd.organizationId, cmd.propertyId, "reservation.updated", r.id);
    return result(r.id, "Estancia movida. Disponibilidad actualizada en CALA.");
  }
  if (cmd.type === "reservation.save") {
    permit(c, cmd.organizationId, "reservation.write", cmd.propertyId);
    const guest = s.guests.find(
      (g) => g.id === cmd.guestId && g.organizationId === cmd.organizationId,
    );
    invariant(
      guest,
      "INVALID_GUEST",
      "El huésped no pertenece a esta organización.",
    );
    const m = membership(s, c.actor, cmd.organizationId);
    invariant(
      !m.propertyIds.length ||
        s.reservations.some(
          (r) => r.guestId === guest.id && m.propertyIds.includes(r.propertyId),
        ) ||
        s.audits.some(
          (a) => a.entityId === guest.id && a.actorId === c.actor.userId,
        ),
      "FORBIDDEN",
      "No tienes acceso a este huésped.",
      403,
    );
    const old = cmd.id
      ? s.reservations.find(
          (r) => r.id === cmd.id && r.propertyId === cmd.propertyId,
        )
      : undefined;
    if (cmd.id) {
      invariant(old, "NOT_FOUND", "Reserva no encontrada.", 404);
      checkVersion(old.version, cmd.version);
      invariant(
        ["draft", "pending", "confirmed"].includes(old.status),
        "INVALID_TRANSITION",
        "Esta reserva ya no puede editarse.",
      );
      invariant(
        cmd.status === old.status,
        "INVALID_TRANSITION",
        "Usa la acción de cambio de estado.",
      );
    }
    const quote = priceStay(
      s,
      cmd.propertyId,
      cmd.inventoryTypeId,
      cmd.ratePlanId,
      cmd.arrival,
      cmd.departure,
    );
    const id = old?.id ?? c.id();
    const r: Reservation = {
      id,
      organizationId: cmd.organizationId,
      propertyId: cmd.propertyId,
      guestId: cmd.guestId,
      inventoryTypeId: cmd.inventoryTypeId,
      unitId: cmd.unitId,
      ratePlanId: cmd.ratePlanId,
      arrival: cmd.arrival,
      departure: cmd.departure,
      adults: cmd.adults,
      children: cmd.children,
      status: old?.status ?? cmd.status,
      notes: cmd.notes,
      version: (old?.version ?? 0) + 1,
      source: old?.source ?? "direct",
      confirmationCode:
        old?.confirmationCode ?? "EST-" + id.slice(0, 8).toUpperCase(),
      currency: s.properties.find((p) => p.id === cmd.propertyId)!.currency,
      totalMinor: quote.totalMinor,
      createdAt: old?.createdAt ?? c.now,
    };
    assertInventory(s, r);
    if (old) Object.assign(old, r);
    else s.reservations.push(r);
    const item = s.folioItems.find(
      (i) => i.reservationId === id && i.kind === "room",
    );
    if (item) {
      item.amountMinor = r.totalMinor;
      item.description = `Alojamiento · ${quote.nights} noches`;
    } else
      s.folioItems.push({
        id: c.id(),
        propertyId: r.propertyId,
        reservationId: id,
        description: `Alojamiento · ${quote.nights} noches`,
        amountMinor: r.totalMinor,
        kind: "room",
        createdAt: c.now,
      });
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
    event(
      c,
      cmd.organizationId,
      cmd.propertyId,
      old ? "reservation.updated" : "reservation.created",
      id,
    );
    return result(id, old ? "Reserva actualizada" : "Reserva creada");
  }
  if (cmd.type === "reservation.transition") {
    permit(
      c,
      cmd.organizationId,
      cmd.status === "cancelled" ? "reservation.cancel" : "reservation.write",
      cmd.propertyId,
    );
    const r = s.reservations.find(
      (r) => r.id === cmd.id && r.propertyId === cmd.propertyId,
    );
    invariant(r, "NOT_FOUND", "Reserva no encontrada.", 404);
    checkVersion(r.version, cmd.version);
    invariant(
      transitions[r.status].includes(cmd.status),
      "INVALID_TRANSITION",
      "Ese cambio de estado no está permitido.",
    );
    if (cmd.status === "checked_in") {
      invariant(
        r.unitId,
        "UNIT_REQUIRED",
        "Asigna una unidad antes del check-in.",
      );
      const u = s.units.find((u) => u.id === r.unitId)!;
      invariant(
        u.housekeeping !== "dirty",
        "ROOM_NOT_READY",
        "La unidad necesita limpieza antes del check-in.",
        409,
      );
    }
    const updated = { ...r, status: cmd.status };
    assertInventory(s, updated);
    r.status = cmd.status;
    r.version++;
    if (cmd.status === "checked_out" && r.unitId) {
      const u = s.units.find((u) => u.id === r.unitId)!;
      u.housekeeping = "dirty";
      u.version++;
    }
    audit(
      c,
      cmd.organizationId,
      cmd.propertyId,
      cmd.type,
      r.id,
      `Estado: ${cmd.status}`,
    );
    event(
      c,
      cmd.organizationId,
      cmd.propertyId,
      cmd.status === "checked_out"
        ? "checkout.completed"
        : cmd.status === "cancelled"
          ? "reservation.cancelled"
          : "reservation.updated",
      r.id,
    );
    return result(r.id, "Estado de reserva actualizado");
  }
}
