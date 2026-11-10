import { importCalendar } from "@/cala/application/jobs/ical";
import { randomUUID } from "node:crypto";
import type { PersistenceAdapter } from "@/cala/application/ports/persistence";
import type {
  JobScheduler,
  MigrationProvider,
  DistributionProvider,
  PaymentProvider,
} from "@/cala/application/ports/providers";
import { MockPaymentProvider } from "./providers";
import { jobPermission } from "@/cala/domain/identity/job-permissions";
import type { MigrationRecord } from "@/cala/domain/model";
import { authorize } from "@/cala/domain/identity/permissions";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import { today, overlaps, nights } from "@/cala/domain/shared/dates";
import { enqueue } from "@/cala/application/commands/jobs";
import { context, audit } from "@/cala/application/context";
import { commitMigration, migrationSteps } from "@/cala/application/jobs/migration";
export class DevelopmentJobScheduler implements JobScheduler {
  constructor(
    private store: PersistenceAdapter,
    private migration: MigrationProvider,
    private distribution: DistributionProvider,
    private payments: PaymentProvider = new MockPaymentProvider(),
  ) {}
  async tick() {
    this.dispatchOutbox();
    const claimed = this.store.transaction((s) => {
      const now = new Date().toISOString();
      const j = [...s.jobs]
        .sort((a, b) => b.step - a.step)
        .find(
          (j) =>
            ["queued", "retry", "running"].includes(j.status) &&
            j.runAfter <= now &&
            (!j.lockedUntil || j.lockedUntil < now),
        );
      if (!j) return null;
      j.status = "running";
      j.lockToken = randomUUID();
      j.lockedUntil = new Date(Date.now() + 30000).toISOString();
      j.updatedAt = now;
      return structuredClone(j);
    });
    if (!claimed) return false;
    try {
      const s = this.store.read();
      authorize(
        s,
        { userId: claimed.actorId, stepUpUntil: null },
        claimed.organizationId,
        jobPermission(claimed.type),
        claimed.propertyId,
      );
      let records: MigrationRecord[] | undefined;
      let paymentResult:
        { externalId: string; status: "succeeded" | "failed" } | undefined;
      if (claimed.type === "payment" && claimed.step === 1) {
        const payment = s.payments.find(
          (p) => p.id === claimed.payload.paymentId,
        );
        invariant(payment, "NOT_FOUND", "Pago no encontrado.");
        paymentResult = await this.payments.pay({
          idempotencyKey: claimed.id,
          amountMinor: payment.amountMinor,
          currency: String(claimed.payload.currency),
          simulateFailure: Boolean(claimed.payload.simulateFailure),
        });
      }
      if (claimed.type === "migration") {
        if (claimed.step === 0)
          await this.migration.connect({
            organizationId: claimed.organizationId,
          });
        if (claimed.step === 1)
          await this.migration.discover({
            connectionId: String(claimed.payload.connectionId),
            externalPropertyId: "fixture-property",
            date: today(),
          });
        if (claimed.step === 2)
          records = await this.migration.extract(
            today(
              s.properties.find((p) => p.id === claimed.propertyId)?.timezone,
            ),
          );
      }
      if (claimed.type === "channel_sync" && claimed.step === 1) {
        const ch = s.channels.find((ch) => ch.id === claimed.payload.channelId);
        invariant(
          ch &&
            ch.status !== "disconnected" &&
            ch.ownership === "pms" &&
            ch.mappings.length,
          "CHANNEL_NOT_READY",
          "Canal sin conexión, mappings o permiso de ownership.",
        );
        await this.distribution.pushARI({
          idempotencyKey: claimed.id,
          inventoryTypeIds: ch.mappings.map((m) => m.inventoryTypeId),
          simulateFailure: ch.simulateFailure,
        });
      }
      this.store.transaction((s) => {
        const j = s.jobs.find((j) => j.id === claimed.id)!;
        if (j.lockToken !== claimed.lockToken) return;
        const c = context(s, { userId: j.actorId, stepUpUntil: null }, j.id);
        authorize(
          s,
          c.actor,
          j.organizationId,
          jobPermission(j.type),
          j.propertyId,
        );
        if (j.type === "migration") {
          j.message = migrationSteps[j.step];
          if (records) j.records = records;
          if (j.step === 3)
            for (const r of j.records)
              if (typeof r.payload.email === "string")
                r.payload.email = r.payload.email.toLowerCase();
          if (
            j.step === 5 &&
            j.payload.includeConflicts &&
            !j.records.some((r) => r.externalId === "fixture-conflict")
          )
            j.records.push({
              externalId: "fixture-conflict",
              kind: "reservation",
              payload: { arrival: "2026-01-05", departure: "2026-01-03" },
              status: "conflict",
              reason:
                "La fecha de salida es anterior a la llegada. Excluye este registro.",
            });
          if (j.step === 6) {
            j.status = "review";
            j.message = "Revisa los registros antes de importar";
          } else if (j.step === 7) commitMigration(c, j);
          else if (j.step === 8) {
            invariant(
              j.records.every((r) =>
                ["imported", "excluded"].includes(r.status),
              ),
              "RECONCILIATION_FAILED",
              "No todos los registros quedaron reconciliados.",
            );
          } else if (j.step === 9) {
            for (const r of j.records.filter(
              (r) => r.kind === "reservation" && r.status === "imported",
            ))
              invariant(
                s.reservations.some((x) => x.id === r.internalId),
                "VERIFY_FAILED",
                "No se encontró una reserva importada.",
              );
          } else if (j.step === 10) {
            j.status = "completed";
            j.message = "Importación de demostración completada";
          }
          if (j.status !== "review") j.step++;
          j.progress =
            j.status === "completed"
              ? 100
              : Math.round((Math.min(j.step, 10) / 11) * 100);
        } else {
          j.step++;
          j.progress = Math.min(100, j.step * 50);
          j.message = j.step === 1 ? "Procesando…" : "Completado";
          if (j.step >= 2) {
            j.status = "completed";
            if (j.type === "channel_sync") {
              const ch = s.channels.find((x) => x.id === j.payload.channelId)!;
              ch.lastSync = c.now;
              ch.lastError = null;
              ch.status = "connected";
              ch.version++;
              j.result = [
                "ARI de demostración confirmado. No se contactó ninguna OTA real.",
              ];
            }
            if (j.type === "payment") {
              invariant(
                paymentResult,
                "MISSING_RECEIPT",
                "No se recibió confirmación del proveedor.",
              );
              const payment = s.payments.find(
                (p) => p.id === j.payload.paymentId,
              )!;
              payment.status = paymentResult.status;
              payment.externalId = paymentResult.externalId;
              j.result = [
                payment.status === "succeeded"
                  ? "Operación financiera de demostración confirmada."
                  : "Pago de demostración rechazado. El saldo no cambió.",
              ];
              if (payment.status === "failed")
                j.message = "Pago rechazado · demostración";
              audit(
                c,
                j.organizationId,
                j.propertyId,
                "payment." + payment.status,
                payment.id,
              );
            }
            if (j.type === "ical_import") importCalendar(c, j);
            if (j.type === "report") {
              const arrival = String(j.payload.arrival),
                departure = String(j.payload.departure);
              const reservations = s.reservations.filter(
                (r) =>
                  r.propertyId === j.propertyId &&
                  overlaps(arrival, departure, r.arrival, r.departure),
              );
              j.result = [
                "confirmacion,llegada,salida,estado",
                ...reservations.map((r) =>
                  [r.confirmationCode, r.arrival, r.departure, r.status].join(
                    ",",
                  ),
                ),
              ];
              j.message = `Reporte listo · ${reservations.length} reservas · ${nights(arrival, departure).length} días`;
            }
          }
        }
        if (j.status === "running") j.status = "queued";
        j.lockedUntil = null;
        j.lockToken = null;
        j.runAfter = new Date(Date.now() + 600).toISOString();
        j.updatedAt = c.now;
        j.lastError = null;
        if (j.status === "completed")
          audit(c, j.organizationId, j.propertyId, "job.completed", j.id);
      });
    } catch (error) {
      this.store.transaction((s) => {
        const j = s.jobs.find((j) => j.id === claimed.id)!;
        if (j.lockToken !== claimed.lockToken) return;
        j.attempts++;
        const permanent = error instanceof DomainError && error.status < 500;
        j.status =
          permanent || j.attempts >= j.maxAttempts ? "dead_letter" : "retry";
        j.lastError =
          error instanceof DomainError
            ? error.message
            : "No se pudo completar el proceso.";
        j.message =
          j.status === "retry"
            ? "Reintentando con espera progresiva"
            : "El proceso necesita atención";
        j.lockedUntil = null;
        j.lockToken = null;
        j.runAfter = new Date(
          Date.now() +
            Math.min(60000, 2 ** j.attempts * 1000) +
            Math.floor(Math.random() * 500),
        ).toISOString();
        j.updatedAt = new Date().toISOString();
        if (j.type === "channel_sync") {
          const ch = s.channels.find((x) => x.id === j.payload.channelId);
          if (ch) {
            ch.status = "error";
            ch.lastError = j.lastError;
          }
        }
      });
    }
    return true;
  }
  private dispatchOutbox() {
    this.store.transaction((s) => {
      for (const e of s.outbox.filter((e) => !e.processedAt).slice(0, 25)) {
        const now = new Date().toISOString();
        for (const rule of s.automations.filter(
          (a) =>
            a.propertyId === e.propertyId && a.enabled && a.trigger === e.type,
        )) {
          const id = `automation:${rule.id}:${e.id}`;
          if (
            s.tasks.some((t) => t.id === id) ||
            s.audits.some((a) => a.id === id)
          )
            continue;
          if (rule.action === "create_task") {
            const reservation = s.reservations.find((r) => r.id === e.entityId);
            s.tasks.push({
              id,
              propertyId: e.propertyId,
              unitId: reservation?.unitId ?? null,
              kind: "housekeeping",
              title: rule.name,
              status: "pending",
              priority: "normal",
              assigneeId: null,
              version: 1,
            });
          }
          s.audits.push({
            id,
            organizationId: e.organizationId,
            propertyId: e.propertyId,
            actorId: "automation",
            action: rule.action,
            entityId: e.entityId,
            requestId: e.id,
            createdAt: now,
            detail: rule.name,
          });
        }
        if (/^(reservation\.|inventory\.|rates\.|checkout\.)/.test(e.type)) {
          for (const channel of s.channels.filter(
            (ch) =>
              ch.propertyId === e.propertyId &&
              ch.status !== "disconnected" &&
              ch.ownership === "pms" &&
              ch.mappings.length,
          )) {
            const dedupe = `ari:${channel.id}:${e.id}`;
            if (s.jobs.some((j) => j.payload.eventKey === dedupe)) continue;
            const member = s.memberships.find((m) => {
              try {
                authorize(
                  s,
                  { userId: m.userId, stepUpUntil: null },
                  e.organizationId,
                  "channel.manage",
                  e.propertyId,
                );
                return true;
              } catch {
                return false;
              }
            });
            if (!member) continue;
            const c = context(
              s,
              { userId: member.userId, stepUpUntil: null },
              e.id,
            );
            enqueue(c, {
              organizationId: e.organizationId,
              propertyId: e.propertyId,
              type: "channel_sync",
              payload: { channelId: channel.id, eventKey: dedupe },
            });
          }
        }
        e.processedAt = now;
      }
    });
  }
}
