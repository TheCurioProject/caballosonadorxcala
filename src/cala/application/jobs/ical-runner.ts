import { randomUUID } from "node:crypto";
import type { PersistenceAdapter } from "../ports/persistence";
import { audit, context } from "../context";
import { importCalendar } from "./ical";
import { authorize } from "@/cala/domain/identity/permissions";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import type { Job } from "@/cala/domain/model";

function ready(job: Job, now: string) {
  return (
    job.type === "ical_import" &&
    ["queued", "retry", "running"].includes(job.status) &&
    job.runAfter <= now &&
    (!job.lockedUntil || job.lockedUntil <= now)
  );
}
/** Local durable worker, restricted to iCal files. No demo providers or network calls. */
export class IcalJobRunner {
  constructor(private store: PersistenceAdapter) {}
  async tick() {
    const now = new Date().toISOString();
    if (!this.store.read().jobs.some((job) => ready(job, now))) return false;
    const claimed = this.store.transaction((state) => {
      const job = state.jobs.find((job) =>
        ready(job, new Date().toISOString()),
      );
      if (!job) return null;
      job.status = "running";
      job.lockToken = randomUUID();
      job.lockedUntil = new Date(Date.now() + 30000).toISOString();
      job.updatedAt = now;
      return { id: job.id, lockToken: job.lockToken };
    });
    if (!claimed) return false;
    try {
      this.store.transaction((state) => {
        const job = state.jobs.find((job) => job.id === claimed.id);
        invariant(
          job &&
            job.lockToken === claimed.lockToken &&
            job.lockedUntil &&
            job.lockedUntil > new Date().toISOString(),
          "STALE_LEASE",
          "El trabajo cambió de procesador.",
          409,
        );
        const actor = { userId: job.actorId, stepUpUntil: null };
        authorize(
          state,
          actor,
          job.organizationId,
          "channel.manage",
          job.propertyId,
        );
        authorize(
          state,
          actor,
          job.organizationId,
          "inventory.write",
          job.propertyId,
        );
        invariant(
          state.units.some(
            (unit) =>
              unit.id === job.payload.unitId &&
              unit.propertyId === job.propertyId &&
              unit.active &&
              state.inventoryTypes.some(
                (type) => type.id === unit.inventoryTypeId && type.active,
              ),
          ),
          "INVALID_UNIT",
          "La unidad ya no está disponible.",
          409,
        );
        const c = context(state, actor, job.id);
        importCalendar(c, job);
        job.status = "completed";
        job.progress = 100;
        job.step = 1;
        job.message = "Calendario importado";
        job.updatedAt = c.now;
        job.lastError = null;
        job.lockToken = null;
        job.lockedUntil = null;
        audit(c, job.organizationId, job.propertyId, "job.completed", job.id);
      });
    } catch (error) {
      this.store.transaction((state) => {
        const job = state.jobs.find((job) => job.id === claimed.id);
        if (!job || job.lockToken !== claimed.lockToken) return;
        job.attempts++;
        job.status =
          (error instanceof DomainError && error.status < 500) ||
          job.attempts >= job.maxAttempts
            ? "dead_letter"
            : "retry";
        job.lastError =
          error instanceof DomainError
            ? error.message
            : "No pudimos completar la importación.";
        job.message =
          job.status === "retry"
            ? "Importación pendiente de reintento"
            : "Revisa la importación";
        job.runAfter = new Date(
          Date.now() + Math.min(60000, 2 ** job.attempts * 1000),
        ).toISOString();
        job.lockToken = null;
        job.lockedUntil = null;
        job.updatedAt = new Date().toISOString();
      });
    }
    return true;
  }
}
