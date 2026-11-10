import { jobPermission } from "@/cala/domain/identity/job-permissions";
import type { Command } from "../schemas";
import type { Context } from "../context";
import type { Job } from "@/cala/domain/model";
import { permit, audit, result, checkVersion } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { nights } from "@/cala/domain/shared/dates";
export function enqueue(
  c: Context,
  input: Pick<Job, "organizationId" | "propertyId" | "type" | "payload">,
) {
  const id = c.id();
  c.state.jobs.push({
    ...input,
    id,
    actorId: c.actor.userId,
    status: "queued",
    step: 0,
    progress: 0,
    message: "En cola",
    attempts: 0,
    maxAttempts: 3,
    runAfter: c.now,
    lockedUntil: null,
    lockToken: null,
    records: [],
    result: [],
    lastError: null,
    createdAt: c.now,
    updatedAt: c.now,
  });
  return id;
}
export function jobCommand(c: Context, cmd: Command) {
  const s = c.state;
  switch (cmd.type) {
    case "channel.create": {
      permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
      const id = c.id();
      s.channels.push({
        id,
        propertyId: cmd.propertyId,
        name: cmd.name,
        provider: "development",
        status: "disconnected",
        syncMode: "ari",
        ownership: "pms",
        mappings: [],
        lastSync: null,
        lastError: null,
        simulateFailure: false,
        version: 1,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Canal creado");
    }
    case "channel.update": {
      permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
      const ch = s.channels.find(
        (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
      );
      invariant(ch, "NOT_FOUND", "Canal no encontrado.", 404);
      checkVersion(ch.version, cmd.version);
      invariant(
        new Set(cmd.mappings.map((m) => m.inventoryTypeId)).size ===
          cmd.mappings.length &&
          new Set(cmd.mappings.map((m) => m.externalId)).size ===
            cmd.mappings.length,
        "DUPLICATE_MAPPING",
        "Los mappings deben ser únicos.",
      );
      for (const m of cmd.mappings)
        invariant(
          s.inventoryTypes.some(
            (t) =>
              t.id === m.inventoryTypeId && t.propertyId === cmd.propertyId,
          ) &&
            s.ratePlans.some(
              (r) => r.id === m.ratePlanId && r.propertyId === cmd.propertyId,
            ),
          "INVALID_MAPPING",
          "El mapping debe pertenecer a esta propiedad.",
        );
      Object.assign(ch, {
        ownership: cmd.ownership,
        syncMode: cmd.syncMode,
        simulateFailure: cmd.simulateFailure,
        status: cmd.status,
        mappings: cmd.mappings,
        version: ch.version + 1,
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, ch.id);
      return result(ch.id);
    }
    case "channel.connect": {
      permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
      invariant(
        new Set(cmd.mappings.map((m) => m.inventoryTypeId)).size ===
          cmd.mappings.length &&
          new Set(cmd.mappings.map((m) => m.externalId)).size ===
            cmd.mappings.length,
        "DUPLICATE_MAPPING",
        "Cada alojamiento y cada ID del canal solo puede vincularse una vez.",
      );
      for (const m of cmd.mappings)
        invariant(
          s.inventoryTypes.some(
            (t) =>
              t.id === m.inventoryTypeId && t.propertyId === cmd.propertyId,
          ) &&
            s.ratePlans.some(
              (r) => r.id === m.ratePlanId && r.propertyId === cmd.propertyId,
            ),
          "INVALID_MAPPING",
          "El mapping debe pertenecer a esta propiedad.",
        );
      const existing = s.channels.find(
        (x) => x.propertyId === cmd.propertyId && x.provider === cmd.provider,
      );
      const value = {
        name: cmd.name,
        provider: cmd.provider,
        status: "connected" as const,
        syncMode: cmd.syncMode,
        ownership: cmd.ownership,
        mappings: cmd.mappings,
        lastError: null,
      };
      let id: string;
      if (existing) {
        Object.assign(existing, value, { version: existing.version + 1 });
        id = existing.id;
      } else {
        id = c.id();
        s.channels.push({
          id,
          propertyId: cmd.propertyId,
          ...value,
          lastSync: null,
          simulateFailure: false,
          version: 1,
        });
      }
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Canal conectado en CALA");
    }
    case "channel.disconnect": {
      permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
      const ch = s.channels.find(
        (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
      );
      invariant(ch, "NOT_FOUND", "Canal no encontrado.", 404);
      checkVersion(ch.version, cmd.version);
      ch.status = "disconnected";
      ch.version++;
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, ch.id);
      return result(ch.id, "Canal desconectado");
    }
    case "channel.sync": {
      permit(c, cmd.organizationId, "channel.manage", cmd.propertyId);
      const ch = s.channels.find(
        (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
      );
      invariant(
        ch && ch.status !== "disconnected",
        "DISCONNECTED",
        "Conecta el canal antes de sincronizar.",
      );
      invariant(
        ch.mappings.length,
        "MAPPING_REQUIRED",
        "Completa los mappings antes de sincronizar.",
      );
      invariant(
        ch.ownership === "pms",
        "FIELD_OWNERSHIP",
        "El canal es la fuente de verdad. Cambia el ownership explícitamente antes de publicar.",
      );
      const id = enqueue(c, {
        organizationId: cmd.organizationId,
        propertyId: cmd.propertyId,
        type: "channel_sync",
        payload: { channelId: ch.id },
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Sincronización encolada");
    }
    case "migration.start": {
      permit(c, cmd.organizationId, "migration.manage", cmd.propertyId);
      const id = enqueue(c, {
        organizationId: cmd.organizationId,
        propertyId: cmd.propertyId,
        type: "migration",
        payload: {
          provider: "development",
          connectionId: "local-import-v1",
          includeConflicts: cmd.includeConflicts,
        },
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Importación iniciada");
    }
    case "migration.review": {
      permit(c, cmd.organizationId, "migration.manage", cmd.propertyId);
      const j = s.jobs.find(
        (j) =>
          j.id === cmd.id &&
          j.propertyId === cmd.propertyId &&
          j.type === "migration",
      );
      invariant(
        j && j.status === "review",
        "NOT_REVIEWABLE",
        "El proceso no está esperando revisión.",
        409,
      );
      const excluded = new Set(cmd.excludeIds);
      for (const r of j.records) {
        invariant(
          r.status !== "conflict" || excluded.has(r.externalId),
          "UNRESOLVED_CONFLICT",
          "Excluye los registros con conflicto antes de importar.",
        );
        if (excluded.has(r.externalId)) r.status = "excluded";
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const r of j.records) {
          if (r.status === "excluded") continue;
          if (
            Object.entries(r.payload).some(
              ([key, value]) =>
                key.endsWith("ExternalId") &&
                typeof value === "string" &&
                excluded.has(value),
            )
          ) {
            r.status = "excluded";
            excluded.add(r.externalId);
            changed = true;
          }
        }
      }
      j.status = "queued";
      j.step = 7;
      j.runAfter = c.now;
      j.updatedAt = c.now;
      j.message = "Revisión confirmada. Importación en cola";
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, j.id);
      return result(j.id, "Revisión guardada");
    }
    case "job.retry": {
      const j = s.jobs.find(
        (j) => j.id === cmd.id && j.propertyId === cmd.propertyId,
      );
      invariant(j, "NOT_FOUND", "Proceso no encontrado.", 404);
      permit(c, cmd.organizationId, jobPermission(j.type), cmd.propertyId);
      invariant(
        ["dead_letter", "retry"].includes(j.status),
        "INVALID_JOB_STATE",
        "El proceso no necesita reintento.",
        409,
      );
      j.status = "queued";
      j.attempts = 0;
      j.runAfter = c.now;
      j.lastError = null;
      j.lockedUntil = null;
      j.lockToken = null;
      j.updatedAt = c.now;
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, j.id);
      return result(j.id, "Reintento encolado");
    }
    case "automation.save": {
      permit(c, cmd.organizationId, "automation.write", cmd.propertyId);
      const old = cmd.id
        ? s.automations.find(
            (a) => a.id === cmd.id && a.propertyId === cmd.propertyId,
          )
        : undefined;
      if (cmd.id)
        invariant(old, "NOT_FOUND", "Automatización no encontrada.", 404);
      const id = old?.id ?? c.id();
      const data = {
        name: cmd.name,
        trigger: cmd.trigger,
        action: cmd.action,
        enabled: cmd.enabled,
      };
      if (old) Object.assign(old, data);
      else s.automations.push({ id, propertyId: cmd.propertyId, ...data });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id);
    }
    case "report.generate": {
      permit(c, cmd.organizationId, "report.read", cmd.propertyId);
      nights(cmd.arrival, cmd.departure);
      const id = enqueue(c, {
        organizationId: cmd.organizationId,
        propertyId: cmd.propertyId,
        type: "report",
        payload: { arrival: cmd.arrival, departure: cmd.departure },
      });
      audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
      return result(id, "Reporte en preparación");
    }
  }
}
