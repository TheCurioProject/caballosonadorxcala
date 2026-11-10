import type { Context } from "../context";
import type { Job, MigrationRecord } from "@/cala/domain/model";
import { assertInventory } from "@/cala/domain/inventory/availability";
import { priceStay } from "@/cala/domain/reservations/pricing";
import { invariant } from "@/cala/domain/shared/errors";
import { audit, event } from "../context";
export { migrationSteps } from "@/cala/domain/migration/stages";
export function commitMigration(c: Context, job: Job) {
  const s = c.state;
  const connection = String(job.payload.connectionId) + ":" + job.propertyId;
  const identity = (kind: string, id: string) =>
    s.externalIdentities.find(
      (x) =>
        x.organizationId === job.organizationId &&
        x.connectionId === connection &&
        x.kind === kind &&
        x.externalId === id,
    );
  const link = (r: MigrationRecord, id: string) => {
    s.externalIdentities.push({
      organizationId: job.organizationId,
      connectionId: connection,
      kind: r.kind,
      externalId: r.externalId,
      internalId: id,
    });
    r.internalId = id;
    r.status = "imported";
  };
  const plan = s.ratePlans.find((p) => p.propertyId === job.propertyId);
  invariant(
    plan,
    "NO_RATE_PLAN",
    "Configura un plan de tarifas antes de importar.",
  );
  for (const kind of ["inventory", "guest", "reservation", "rate"] as const)
    for (const record of job.records.filter(
      (r) => r.kind === kind && r.status !== "excluded",
    )) {
      const previous = identity(kind, record.externalId);
      if (previous) {
        record.internalId = previous.internalId;
        record.status = "imported";
        continue;
      }
      invariant(
        record.status !== "conflict",
        "UNRESOLVED_CONFLICT",
        "Hay conflictos sin resolver.",
      );
      const id = c.id(),
        p = record.payload;
      if (kind === "inventory") {
        s.inventoryTypes.push({
          id,
          propertyId: job.propertyId,
          name: String(p.name),
          sellMode: "unit",
          maxOccupancy: Number(p.maxOccupancy),
          baseRateMinor: Number(p.baseRateMinor),
          amenities: [],
          active: true,
        });
        s.units.push({
          id: c.id(),
          propertyId: job.propertyId,
          inventoryTypeId: id,
          name: "Importada 01",
          parentUnitId: null,
          active: true,
          housekeeping: "clean",
          version: 1,
        });
      }
      if (kind === "guest")
        s.guests.push({
          id,
          organizationId: job.organizationId,
          firstName: String(p.firstName),
          lastName: String(p.lastName),
          email: String(p.email),
          phone: "",
          country: "MX",
          notes: "Datos importados.",
          version: 1,
        });
      if (kind === "reservation") {
        const guest = identity("guest", String(p.guestExternalId));
        const type = identity("inventory", String(p.inventoryExternalId));
        invariant(
          guest && type,
          "DEPENDENCY_MISSING",
          "Faltan dependencias de la reserva importada.",
        );
        const quote = priceStay(
          s,
          job.propertyId,
          type.internalId,
          plan.id,
          String(p.arrival),
          String(p.departure),
        );
        const r = {
          id,
          organizationId: job.organizationId,
          propertyId: job.propertyId,
          guestId: guest.internalId,
          inventoryTypeId: type.internalId,
          unitId: s.units.find((u) => u.inventoryTypeId === type.internalId)!
            .id,
          ratePlanId: plan.id,
          arrival: String(p.arrival),
          departure: String(p.departure),
          adults: Number(p.adults),
          children: 0,
          status: "confirmed" as const,
          source: "import",
          confirmationCode: "IMP-" + id.slice(0, 8),
          currency: s.properties.find((x) => x.id === job.propertyId)!.currency,
          totalMinor: quote.totalMinor,
          notes: "Datos importados",
          version: 1,
          createdAt: c.now,
        };
        assertInventory(s, r);
        s.reservations.push(r);
        s.folioItems.push({
          id: c.id(),
          propertyId: job.propertyId,
          reservationId: id,
          description: "Estancia importada",
          amountMinor: r.totalMinor,
          kind: "room",
          createdAt: c.now,
        });
        event(c, job.organizationId, job.propertyId, "reservation.created", id);
      }
      if (kind === "rate") {
        const type = identity("inventory", String(p.inventoryExternalId));
        invariant(
          type,
          "DEPENDENCY_MISSING",
          "Falta inventario para la tarifa.",
        );
        const existing = s.rateDays.find(
          (d) =>
            d.ratePlanId === plan.id &&
            d.inventoryTypeId === type.internalId &&
            d.date === String(p.date),
        );
        if (existing) {
          record.status = "excluded";
          record.reason = "Ya existe una tarifa para esta fecha.";
          continue;
        }
        s.rateDays.push({
          id,
          propertyId: job.propertyId,
          inventoryTypeId: type.internalId,
          ratePlanId: plan.id,
          date: String(p.date),
          amountMinor: Number(p.amountMinor),
          minStay: 1,
          maxStay: 730,
          closed: false,
          cta: false,
          ctd: false,
          version: 1,
        });
      }
      link(record, id);
      audit(
        c,
        job.organizationId,
        job.propertyId,
        "migration.record.imported",
        id,
      );
    }
  job.result = [
    `${job.records.filter((r) => r.status === "imported").length} registros reconciliados`,
    `${job.records.filter((r) => r.status === "excluded").length} registros excluidos`,
    "Reconecta canales y pagos con sus proveedores autorizados.",
  ];
}
