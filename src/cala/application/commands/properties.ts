import type { Command } from "../schemas";
import type { Context } from "../context";
import { permit, audit, result, checkVersion, event } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { membership, canManageRole } from "@/cala/domain/identity/permissions";
import { amenityLabel } from "@/cala/domain/properties/options";
export function propertyCommand(c: Context, cmd: Command) {
  const s = c.state;
  switch (cmd.type) {
    case "workspace.preferences.save": {
      permit(c, cmd.organizationId, "property.read");
      s.workspacePreferences ??= [];
      const row = s.workspacePreferences.find(
        (p) =>
          p.organizationId === cmd.organizationId &&
          p.userId === c.actor.userId,
      );
      invariant(
        (row?.version ?? 0) === cmd.version,
        "VERSION_CONFLICT",
        "Tus preferencias cambiaron en otro dispositivo. Vuelve a abrir la personalización.",
        409,
      );
      const id = row?.id ?? c.id();
      if (row)
        Object.assign(row, {
          preferences: structuredClone(cmd.preferences),
          version: row.version + 1,
          updatedAt: c.now,
        });
      else
        s.workspacePreferences.push({
          id,
          organizationId: cmd.organizationId,
          userId: c.actor.userId,
          preferences: structuredClone(cmd.preferences),
          version: 1,
          updatedAt: c.now,
        });
      audit(c, cmd.organizationId, null, cmd.type, id);
      return result(id, "Preferencias guardadas para tus dispositivos");
    }
    case "organization.create": {
      const id = c.id();
      s.organizations.push({
        id,
        name: cmd.name,
        currency: "MXN",
        timezone: "America/Mexico_City",
      });
      s.memberships.push({
        id: c.id(),
        organizationId: id,
        userId: c.actor.userId,
        role: "owner",
        propertyIds: [],
        status: "active",
      });
      audit(c, id, null, cmd.type, id);
      return result(id, "Organización creada");
    }
    case "onboarding.save": {
      permit(c, cmd.organizationId, "property.write");
      let d = s.drafts.find(
        (d) =>
          d.organizationId === cmd.organizationId &&
          d.userId === c.actor.userId,
      );
      if (!d) {
        d = {
          id: c.id(),
          organizationId: cmd.organizationId,
          userId: c.actor.userId,
          step: 0,
          data: {},
          updatedAt: c.now,
        };
        s.drafts.push(d);
      }
      d.step = cmd.step;
      d.data = cmd.data;
      d.updatedAt = c.now;
      return result(d.id);
    }
    case "property.create": {
      const amenities = cmd.amenities.map(amenityLabel);
      invariant(
        cmd.concept !== "entire_home" ||
          (cmd.unitCount === 1 && cmd.sellMode === "unit"),
        "INVALID_HOME",
        "Una casa completa se vende como una sola unidad.",
      );
      invariant(
        cmd.concept === "hostel" || cmd.sellMode === "unit",
        "INVALID_SELL_MODE",
        "La venta por camas requiere el concepto hostal.",
      );
      permit(c, cmd.organizationId, "property.write");
      const id = c.id();
      s.properties.push({
        id,
        organizationId: cmd.organizationId,
        name: cmd.name,
        concept: cmd.concept,
        city: cmd.city,
        address: cmd.address,
        country: "MX",
        timezone: cmd.timezone,
        currency: cmd.currency,
        checkIn: cmd.checkIn,
        checkOut: cmd.checkOut,
        policy: cmd.policy,
        taxBps: cmd.taxBps,
        allowedOverbooking: 0,
        onboardingComplete: true,
        version: 1,
      });
      const m = membership(s, c.actor, cmd.organizationId);
      if (m.propertyIds.length) m.propertyIds.push(id);
      const typeId = c.id();
      s.inventoryTypes.push({
        id: typeId,
        propertyId: id,
        name:
          cmd.sellMode === "unit"
            ? cmd.concept === "entire_home"
              ? "Casa completa"
              : "Unidad estándar"
            : "Cama en dormitorio",
        sellMode: cmd.sellMode === "unit" ? "unit" : "bed",
        maxOccupancy: cmd.sellMode === "unit" ? cmd.maxOccupancy : 1,
        baseRateMinor: cmd.baseRateMinor,
        amenities,
        active: true,
      });
      let parentId: string | null = null;
      if (cmd.sellMode === "both") {
        const parentType = c.id();
        parentId = c.id();
        s.inventoryTypes.push({
          id: parentType,
          propertyId: id,
          name: "Dormitorio completo",
          sellMode: "unit",
          maxOccupancy: cmd.unitCount,
          baseRateMinor: cmd.baseRateMinor * cmd.unitCount,
          amenities,
          active: true,
        });
        s.units.push({
          id: parentId,
          propertyId: id,
          inventoryTypeId: parentType,
          name: "Dormitorio A",
          parentUnitId: null,
          active: true,
          housekeeping: "clean",
          version: 1,
        });
      }
      for (let i = 1; i <= cmd.unitCount; i++)
        s.units.push({
          id: c.id(),
          propertyId: id,
          inventoryTypeId: typeId,
          name: (cmd.sellMode === "unit" ? "Unidad " : "Cama ") + i,
          attributes: {
            bedrooms: cmd.bedrooms,
            beds: cmd.beds,
            bathrooms: cmd.bathrooms,
          },
          parentUnitId: parentId,
          active: true,
          housekeeping: "clean",
          version: 1,
        });
      s.ratePlans.push({
        id: c.id(),
        propertyId: id,
        name: "Tarifa flexible",
        active: true,
      });
      s.drafts = s.drafts.filter(
        (d) =>
          !(
            d.organizationId === cmd.organizationId &&
            d.userId === c.actor.userId
          ),
      );
      audit(c, cmd.organizationId, id, cmd.type, id);
      return result(id, "Tu propiedad está lista");
    }
    case "property.update": {
      permit(c, cmd.organizationId, "property.write", cmd.propertyId);
      const p = s.properties.find((p) => p.id === cmd.propertyId)!;
      checkVersion(p.version, cmd.version);
      Object.assign(p, {
        name: cmd.name,
        city: cmd.city,
        policy: cmd.policy,
        allowedOverbooking: cmd.allowedOverbooking,
        address: cmd.address ?? p.address,
        concept: cmd.concept ?? p.concept,
        checkIn: cmd.checkIn ?? p.checkIn,
        checkOut: cmd.checkOut ?? p.checkOut,
        taxBps: cmd.taxBps ?? p.taxBps,
        version: p.version + 1,
      });
      audit(c, cmd.organizationId, p.id, cmd.type, p.id);
      event(c, cmd.organizationId, p.id, "inventory.changed", p.id);
      return result(p.id);
    }
    case "guest.save": {
      permit(c, cmd.organizationId, "reservation.write", cmd.propertyId);
      permit(c, cmd.organizationId, "guest.pii.read", cmd.propertyId);
      const g = cmd.id
        ? s.guests.find(
            (g) => g.id === cmd.id && g.organizationId === cmd.organizationId,
          )
        : undefined;
      if (cmd.id) {
        invariant(g, "NOT_FOUND", "Huésped no encontrado.", 404);
        checkVersion(g.version, cmd.version);
        const m = membership(s, c.actor, cmd.organizationId);
        invariant(
          !m.propertyIds.length ||
            s.reservations.some(
              (r) => r.guestId === g.id && r.propertyId === cmd.propertyId,
            ),
          "FORBIDDEN",
          "No tienes acceso a este huésped.",
          403,
        );
      }
      const data = {
        firstName: cmd.firstName,
        lastName: cmd.lastName,
        email: cmd.email.toLowerCase(),
        phone: cmd.phone,
        country: cmd.country,
        notes: cmd.notes,
        ...Object.fromEntries(
          (
            [
              "company",
              "address",
              "city",
              "region",
              "postalCode",
              "language",
            ] as const
          )
            .filter((key) => cmd[key] !== undefined)
            .map((key) => [key, cmd[key]]),
        ),
      };
      const id = g?.id ?? c.id();
      if (g) Object.assign(g, data, { version: g.version + 1 });
      else
        s.guests.push({
          id,
          organizationId: cmd.organizationId,
          ...data,
          version: 1,
        });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Huésped guardado");
    }
    case "team.invite": {
      const self = permit(c, cmd.organizationId, "team.manage");
      invariant(
        canManageRole(self.role, cmd.role),
        "ROLE_ESCALATION",
        cmd.role === "admin"
          ? "Sólo el propietario puede asignar administradores."
          : "Sólo puedes asignar roles por debajo del tuyo.",
        403,
      );
      invariant(
        cmd.propertyIds.every((id) =>
          s.properties.some(
            (p) => p.id === id && p.organizationId === cmd.organizationId,
          ),
        ),
        "INVALID_SCOPE",
        "Propiedad no válida.",
      );
      invariant(
        cmd.role !== "owner",
        "OWNER_TRANSFER",
        "La transferencia de propiedad requiere un flujo específico.",
      );
      const email = cmd.email.toLowerCase();
      let user = s.users.find((u) => u.email === email);
      if (!user) {
        user = { id: c.id(), name: cmd.name, email };
        s.users.push(user);
      }
      invariant(
        !s.memberships.some(
          (m) =>
            m.userId === user!.id && m.organizationId === cmd.organizationId,
        ),
        "DUPLICATE_MEMBER",
        "Esta persona ya pertenece al equipo.",
      );
      const id = c.id();
      s.memberships.push({
        id,
        userId: user.id,
        organizationId: cmd.organizationId,
        role: cmd.role,
        status: "active",
        propertyIds: cmd.propertyIds,
      });
      audit(c, cmd.organizationId, null, cmd.type, id);
      return {
        id,
        message: "Miembro creado",
        warning: "No se envió correo. Esta cuenta sólo existe en desarrollo.",
      };
    }
    case "team.remove": {
      const self = permit(c, cmd.organizationId, "team.manage");
      const m = s.memberships.find(
        (m) => m.id === cmd.id && m.organizationId === cmd.organizationId,
      );
      invariant(m, "NOT_FOUND", "Miembro no encontrado.", 404);
      invariant(
        m.userId !== c.actor.userId,
        "SELF_ROLE",
        "No puedes retirarte a ti mismo del equipo.",
      );
      invariant(
        canManageRole(self.role, m.role),
        "ROLE_ESCALATION",
        "Sólo puedes gestionar roles por debajo del tuyo.",
        403,
      );
      s.memberships = s.memberships.filter((x) => x.id !== m.id);
      s.sessions = s.sessions.filter((x) => x.userId !== m.userId);
      audit(c, cmd.organizationId, null, cmd.type, m.id);
      return result(m.id, "Miembro retirado del equipo");
    }
    case "team.update": {
      const self = permit(c, cmd.organizationId, "team.manage");
      const m = s.memberships.find(
        (m) => m.id === cmd.id && m.organizationId === cmd.organizationId,
      );
      invariant(m, "NOT_FOUND", "Miembro no encontrado.", 404);
      invariant(
        m.userId !== c.actor.userId,
        "SELF_ROLE",
        "No puedes modificar tu propia membresía.",
      );
      invariant(
        m.role !== "owner" && cmd.role !== "owner",
        "OWNER_TRANSFER",
        "La propiedad de la organización no se modifica desde este control.",
      );
      invariant(
        canManageRole(self.role, m.role) && canManageRole(self.role, cmd.role),
        "ROLE_ESCALATION",
        cmd.role === "admin" || m.role === "admin"
          ? "Sólo el propietario puede asignar administradores."
          : "Sólo puedes gestionar roles por debajo del tuyo.",
        403,
      );
      invariant(
        cmd.propertyIds.every((id) =>
          s.properties.some(
            (p) => p.id === id && p.organizationId === cmd.organizationId,
          ),
        ),
        "INVALID_SCOPE",
        "Propiedad no válida.",
      );
      Object.assign(m, {
        role: cmd.role,
        status: cmd.status,
        propertyIds: cmd.propertyIds,
      });
      if (cmd.status === "suspended")
        s.sessions = s.sessions.filter((x) => x.userId !== m.userId);
      audit(c, cmd.organizationId, null, cmd.type, m.id);
      return result(m.id);
    }
  }
}
