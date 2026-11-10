import type { Command } from "../schemas";
import type { Context } from "../context";
import { audit, checkVersion, permit, result } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { validateTemplate } from "@/cala/domain/messaging/templates";
import { today } from "@/cala/domain/shared/dates";

export function hospitalityCommand(c: Context, cmd: Command) {
  const s = c.state;
  if (cmd.type === "market.import") {
    permit(c, cmd.organizationId, "rates.write", cmd.propertyId);
    permit(c, cmd.organizationId, "report.read", cmd.propertyId);
    const property = s.properties.find((p) => p.id === cmd.propertyId)!;
    const asOf = today(property.timezone);
    const keys = new Set<string>();
    for (const row of cmd.rows) {
      invariant(
        row.currency === property.currency,
        "MARKET_CURRENCY",
        "La moneda del mercado debe coincidir con la propiedad.",
      );
      invariant(
        row.observedOn <= asOf,
        "FUTURE_OBSERVATION",
        "La fecha de observación no puede ser futura.",
      );
      const key = JSON.stringify([
        row.source,
        row.market,
        row.date,
        row.observedOn,
      ]);
      invariant(
        !keys.has(key),
        "DUPLICATE_OBSERVATION",
        "El lote contiene observaciones duplicadas.",
      );
      keys.add(key);
      const old = s.marketObservations.find(
        (r) =>
          r.propertyId === cmd.propertyId &&
          r.source === row.source &&
          r.market === row.market &&
          r.date === row.date &&
          r.observedOn === row.observedOn,
      );
      if (old) Object.assign(old, row);
      else
        s.marketObservations.push({
          id: c.id(),
          propertyId: cmd.propertyId,
          ...row,
        });
    }
    audit(
      c,
      cmd.organizationId,
      cmd.propertyId,
      cmd.type,
      cmd.propertyId,
      `${cmd.rows.length} observaciones importadas`,
    );
    return result(
      cmd.propertyId,
      `${cmd.rows.length} observaciones de mercado guardadas`,
    );
  }
  if (
    ![
      "conversation.update",
      "message.save",
      "message.cancel",
      "template.save",
      "template.delete",
    ].includes(cmd.type)
  )
    return;
  // Message bodies are confidential, including drafts and internal notes.
  if (!("propertyId" in cmd) || !("organizationId" in cmd)) return;
  permit(c, cmd.organizationId, "message.write", cmd.propertyId);
  permit(c, cmd.organizationId, "guest.pii.read", cmd.propertyId);
  if (cmd.type === "template.save") {
    validateTemplate(cmd.body);
    validateTemplate(cmd.subject);
    const old = cmd.id
      ? s.messageTemplates.find(
          (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
        )
      : undefined;
    if (cmd.id) {
      invariant(old, "NOT_FOUND", "Plantilla no encontrada.", 404);
      checkVersion(old.version, cmd.version);
    }
    const value = {
      id: old?.id ?? c.id(),
      propertyId: cmd.propertyId,
      name: cmd.name,
      locale: cmd.locale,
      subject: cmd.subject,
      body: cmd.body,
      trigger: cmd.trigger,
      offsetDays: cmd.offsetDays,
      version: (old?.version ?? 0) + 1,
    };
    if (old) Object.assign(old, value);
    else s.messageTemplates.push(value);
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, value.id);
    return result(value.id, "Plantilla guardada");
  }
  if (cmd.type === "template.delete") {
    const old = s.messageTemplates.find(
      (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
    );
    invariant(old, "NOT_FOUND", "Plantilla no encontrada.", 404);
    checkVersion(old.version, cmd.version);
    s.messageTemplates = s.messageTemplates.filter((x) => x.id !== old.id);
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, old.id);
    return result(old.id, "Plantilla eliminada");
  }
  if (cmd.type === "message.cancel") {
    const old = s.messageEntries.find(
      (x) => x.id === cmd.id && x.propertyId === cmd.propertyId,
    );
    invariant(old, "NOT_FOUND", "Mensaje no encontrado.", 404);
    checkVersion(old.version, cmd.version);
    invariant(
      ["draft", "blocked"].includes(old.status),
      "MESSAGE_STATE",
      "Solo se pueden cancelar borradores o mensajes pendientes de conexión.",
    );
    old.status = "cancelled";
    old.version++;
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, old.id);
    return result(old.id, "Mensaje cancelado");
  }
  if (cmd.type !== "message.save" && cmd.type !== "conversation.update") return;
  const reservation = s.reservations.find(
    (r) =>
      r.id === cmd.reservationId &&
      r.propertyId === cmd.propertyId &&
      r.organizationId === cmd.organizationId,
  );
  invariant(reservation, "NOT_FOUND", "Reserva no encontrada.", 404);
  let thread = s.conversations.find(
    (x) =>
      x.reservationId === reservation.id && x.propertyId === cmd.propertyId,
  );
  if (cmd.type === "conversation.update") {
    if (thread) checkVersion(thread.version, cmd.version);
    else
      invariant(
        cmd.version === undefined,
        "VERSION_CONFLICT",
        "La conversación cambió. Recarga antes de guardar.",
        409,
      );
    invariant(
      !cmd.assigneeId ||
        s.memberships.some(
          (m) =>
            m.userId === cmd.assigneeId &&
            m.organizationId === cmd.organizationId &&
            m.status === "active" &&
            (!m.propertyIds.length || m.propertyIds.includes(cmd.propertyId)),
        ),
      "INVALID_ASSIGNEE",
      "Selecciona una persona con acceso a la propiedad.",
    );
    const value = {
      id: thread?.id ?? c.id(),
      propertyId: cmd.propertyId,
      reservationId: reservation.id,
      status: cmd.status,
      assigneeId: cmd.assigneeId,
      version: (thread?.version ?? 0) + 1,
      updatedAt: c.now,
    };
    if (thread) Object.assign(thread, value);
    else s.conversations.push(value);
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, value.id);
    return result(value.id, "Conversación actualizada");
  }
  if (cmd.mode !== "note")
    invariant(
      !["cancelled", "no_show"].includes(reservation.status),
      "RESERVATION_INACTIVE",
      "La reserva ya no está activa; puedes añadir una nota interna.",
    );
  if (cmd.scheduledAt)
    invariant(
      Date.parse(cmd.scheduledAt) > Date.parse(c.now),
      "PAST_SCHEDULE",
      "Elige una hora de envío futura.",
    );
  const old = cmd.id
    ? s.messageEntries.find(
        (x) =>
          x.id === cmd.id &&
          x.propertyId === cmd.propertyId &&
          x.reservationId === reservation.id,
      )
    : undefined;
  if (cmd.id) {
    invariant(old, "NOT_FOUND", "Borrador no encontrado.", 404);
    checkVersion(old.version, cmd.version);
    invariant(
      old.status === "draft",
      "MESSAGE_STATE",
      "Solo se pueden editar borradores.",
    );
  }
  const status =
    cmd.mode === "note"
      ? ("recorded" as const)
      : cmd.mode === "draft"
        ? ("draft" as const)
        : ("blocked" as const);
  const entry = {
    id: old?.id ?? c.id(),
    propertyId: cmd.propertyId,
    reservationId: reservation.id,
    direction:
      cmd.mode === "note" ? ("internal" as const) : ("outbound" as const),
    status,
    subject: cmd.subject,
    body: cmd.body,
    scheduledAt: cmd.mode === "note" ? null : cmd.scheduledAt,
    failureCode:
      status === "blocked" ? "MESSAGING_PROVIDER_NOT_CONFIGURED" : null,
    authorId: c.actor.userId,
    createdAt: old?.createdAt ?? c.now,
    version: (old?.version ?? 0) + 1,
  };
  if (old) Object.assign(old, entry);
  else s.messageEntries.push(entry);
  if (!thread) {
    thread = {
      id: c.id(),
      propertyId: cmd.propertyId,
      reservationId: reservation.id,
      status: "open",
      assigneeId: null,
      version: 1,
      updatedAt: c.now,
    };
    s.conversations.push(thread);
  } else {
    thread.updatedAt = c.now;
    thread.version++;
    if (cmd.mode !== "note") thread.status = "open";
  }
  audit(
    c,
    cmd.organizationId,
    cmd.propertyId,
    cmd.type,
    entry.id,
    `Estado: ${status}`,
  );
  const response = result(
    entry.id,
    cmd.mode === "note"
      ? "Nota interna guardada"
      : cmd.mode === "draft"
        ? "Borrador guardado"
        : "Mensaje preparado, pendiente de conexión",
  );
  return status === "blocked"
    ? {
        ...response,
        warning:
          "Mensaje guardado sin enviar. Conecta un proveedor de mensajería para entregarlo.",
      }
    : response;
}
