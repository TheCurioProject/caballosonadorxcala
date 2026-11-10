import type { Command } from "../schemas";
import type { Context } from "../context";
import { permit, audit, result, checkVersion, event } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { nights, overlaps } from "@/cala/domain/shared/dates";
import {
  consuming,
  unitsConflict,
  assertInventory,
} from "@/cala/domain/inventory/availability";
export function inventoryCommand(c: Context, cmd: Command) {
  const s = c.state;
  switch (cmd.type) {
    case "inventory.create": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      if (cmd.parentUnitId)
        invariant(
          s.units.some(
            (u) =>
              u.id === cmd.parentUnitId &&
              u.propertyId === cmd.propertyId &&
              !u.parentUnitId,
          ),
          "INVALID_PARENT",
          "Selecciona una habitación de esta propiedad.",
        );
      const id = c.id();
      s.inventoryTypes.push({
        id,
        propertyId: cmd.propertyId,
        name: cmd.name,
        sellMode: cmd.sellMode,
        maxOccupancy: cmd.maxOccupancy,
        baseRateMinor: cmd.baseRateMinor,
        amenities: cmd.amenities,
        active: true,
      });
      for (let i = 1; i <= cmd.unitCount; i++)
        s.units.push({
          id: c.id(),
          propertyId: cmd.propertyId,
          inventoryTypeId: id,
          name: `${cmd.name} ${i}`,
          parentUnitId: cmd.parentUnitId,
          active: true,
          housekeeping: "clean",
          version: 1,
        });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", id);
      return result(id, "Inventario creado");
    }
    case "inventory.update": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      const t = s.inventoryTypes.find(
        (t) => t.id === cmd.id && t.propertyId === cmd.propertyId,
      );
      invariant(t, "NOT_FOUND", "Alojamiento no encontrado.", 404);
      Object.assign(t, {
        name: cmd.name,
        maxOccupancy: cmd.maxOccupancy,
        baseRateMinor: cmd.baseRateMinor,
        active: cmd.active,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, t.id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", t.id);
      return result(t.id, "Alojamiento actualizado");
    }
    case "unit.update": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      const u = s.units.find(
        (u) => u.id === cmd.id && u.propertyId === cmd.propertyId,
      );
      invariant(u, "NOT_FOUND", "Unidad no encontrada.", 404);
      checkVersion(u.version, cmd.version);
      invariant(
        s.inventoryTypes.some(
          (t) =>
            t.id === cmd.inventoryTypeId && t.propertyId === cmd.propertyId,
        ),
        "INVALID_INVENTORY",
        "Tipo no válido.",
      );
      invariant(
        !s.units.some(
          (x) =>
            x.propertyId === cmd.propertyId &&
            x.name === cmd.name &&
            x.id !== u.id,
        ),
        "DUPLICATE_UNIT",
        "El nombre de la unidad ya existe.",
      );
      Object.assign(u, {
        name: cmd.name,
        inventoryTypeId: cmd.inventoryTypeId,
        active: cmd.active,
        attributes: cmd.attributes ?? u.attributes,
        version: u.version + 1,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, u.id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", u.id);
      return result(u.id, "Unidad actualizada");
    }
    case "unit.create": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      invariant(
        s.inventoryTypes.some(
          (t) =>
            t.id === cmd.inventoryTypeId && t.propertyId === cmd.propertyId,
        ),
        "INVALID_INVENTORY",
        "Tipo no válido.",
      );
      if (cmd.parentUnitId)
        invariant(
          s.units.some(
            (u) =>
              u.id === cmd.parentUnitId &&
              u.propertyId === cmd.propertyId &&
              !u.parentUnitId,
          ),
          "INVALID_PARENT",
          "Habitación no válida.",
        );
      invariant(
        !s.units.some(
          (u) => u.propertyId === cmd.propertyId && u.name === cmd.name,
        ),
        "DUPLICATE_UNIT",
        "El nombre de la unidad ya existe.",
      );
      const id = c.id();
      s.units.push({
        id,
        propertyId: cmd.propertyId,
        inventoryTypeId: cmd.inventoryTypeId,
        name: cmd.name,
        parentUnitId: cmd.parentUnitId,
        active: true,
        housekeeping: "clean",
        version: 1,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", id);
      return result(id);
    }
    case "block.create": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      nights(cmd.arrival, cmd.departure);
      invariant(
        s.units.some(
          (u) => u.id === cmd.unitId && u.propertyId === cmd.propertyId,
        ),
        "INVALID_UNIT",
        "Unidad no válida.",
      );
      invariant(
        !s.reservations.some(
          (r) =>
            r.unitId &&
            consuming(r) &&
            overlaps(cmd.arrival, cmd.departure, r.arrival, r.departure) &&
            unitsConflict(s, r.unitId, cmd.unitId),
        ),
        "BLOCK_CONFLICT",
        "Hay reservas en ese período. Reubícalas antes de bloquear.",
        409,
      );
      const id = c.id();
      s.blocks.push({
        id,
        propertyId: cmd.propertyId,
        unitId: cmd.unitId,
        arrival: cmd.arrival,
        departure: cmd.departure,
        reason: cmd.reason,
        active: true,
      });
      for (const r of s.reservations.filter(
        (r) =>
          r.propertyId === cmd.propertyId &&
          !r.unitId &&
          consuming(r) &&
          overlaps(cmd.arrival, cmd.departure, r.arrival, r.departure),
      ))
        assertInventory(s, r);
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", id);
      return result(id, "Unidad bloqueada");
    }
    case "block.release": {
      permit(c, cmd.organizationId, "inventory.write", cmd.propertyId);
      const b = s.blocks.find(
        (b) => b.id === cmd.id && b.propertyId === cmd.propertyId,
      );
      invariant(b, "NOT_FOUND", "Bloqueo no encontrado.", 404);
      b.active = false;
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, b.id);
      event(c, cmd.organizationId, cmd.propertyId, "inventory.changed", b.id);
      return result(b.id, "Bloqueo liberado");
    }
    case "ratePlan.create": {
      permit(c, cmd.organizationId, "rates.write", cmd.propertyId);
      const id = c.id();
      s.ratePlans.push({
        id,
        propertyId: cmd.propertyId,
        name: cmd.name,
        active: true,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id);
    }
    case "rates.bulk": {
      permit(c, cmd.organizationId, "rates.write", cmd.propertyId);
      invariant(
        cmd.maxStay >= cmd.minStay,
        "INVALID_RESTRICTION",
        "El máximo debe ser mayor o igual al mínimo.",
      );
      invariant(
        s.ratePlans.some(
          (r) => r.id === cmd.ratePlanId && r.propertyId === cmd.propertyId,
        ) &&
          s.inventoryTypes.some(
            (t) =>
              t.id === cmd.inventoryTypeId && t.propertyId === cmd.propertyId,
          ),
        "INVALID_RATE",
        "Plan o inventario no válido.",
      );
      for (const date of nights(cmd.arrival, cmd.departure)) {
        let d = s.rateDays.find(
          (d) =>
            d.ratePlanId === cmd.ratePlanId &&
            d.inventoryTypeId === cmd.inventoryTypeId &&
            d.date === date,
        );
        checkVersion(d?.version ?? 0, cmd.expectedVersions[date] ?? 0);
        if (!d) {
          d = {
            id: c.id(),
            propertyId: cmd.propertyId,
            ratePlanId: cmd.ratePlanId,
            inventoryTypeId: cmd.inventoryTypeId,
            date,
            amountMinor: 0,
            minStay: 1,
            maxStay: 730,
            closed: false,
            cta: false,
            ctd: false,
            version: 0,
          };
          s.rateDays.push(d);
        }
        Object.assign(d, {
          amountMinor: cmd.amountMinor,
          minStay: cmd.minStay,
          maxStay: cmd.maxStay,
          closed: cmd.closed,
          cta: cmd.cta,
          ctd: cmd.ctd,
          version: d.version + 1,
        });
      }
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, cmd.ratePlanId);
      event(
        c,
        cmd.organizationId,
        cmd.propertyId,
        "rates.changed",
        cmd.ratePlanId,
      );
      return result(cmd.ratePlanId, "Tarifas y restricciones actualizadas");
    }
    case "unit.clean": {
      permit(c, cmd.organizationId, "operations.write", cmd.propertyId);
      const u = s.units.find(
        (u) => u.id === cmd.id && u.propertyId === cmd.propertyId,
      );
      invariant(u, "NOT_FOUND", "Unidad no encontrada.", 404);
      checkVersion(u.version, cmd.version);
      u.housekeeping = cmd.status;
      u.version++;
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, u.id);
      return result(u.id);
    }
    case "task.save": {
      permit(c, cmd.organizationId, "operations.write", cmd.propertyId);
      if (cmd.unitId)
        invariant(
          s.units.some(
            (u) => u.id === cmd.unitId && u.propertyId === cmd.propertyId,
          ),
          "INVALID_UNIT",
          "Unidad no válida.",
        );
      if (cmd.assigneeId)
        invariant(
          s.memberships.some(
            (m) =>
              m.userId === cmd.assigneeId &&
              m.organizationId === cmd.organizationId &&
              m.status === "active" &&
              (!m.propertyIds.length || m.propertyIds.includes(cmd.propertyId)),
          ),
          "INVALID_ASSIGNEE",
          "Esta persona no tiene acceso a la propiedad.",
        );
      const t = cmd.id
        ? s.tasks.find(
            (t) => t.id === cmd.id && t.propertyId === cmd.propertyId,
          )
        : undefined;
      if (cmd.id) {
        invariant(t, "NOT_FOUND", "Tarea no encontrada.", 404);
        checkVersion(t.version, cmd.version);
      }
      const id = t?.id ?? c.id();
      const data = {
        unitId: cmd.unitId,
        kind: cmd.kind,
        title: cmd.title,
        status: cmd.status,
        priority: cmd.priority,
        assigneeId: cmd.assigneeId,
      };
      if (t) Object.assign(t, data, { version: t.version + 1 });
      else
        s.tasks.push({ id, propertyId: cmd.propertyId, ...data, version: 1 });
      if (
        cmd.status === "completed" &&
        cmd.kind === "housekeeping" &&
        cmd.unitId
      ) {
        const u = s.units.find((u) => u.id === cmd.unitId)!;
        u.housekeeping = "clean";
        u.version++;
      }
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id);
    }
  }
}
