"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Badge,
  Empty,
  Icon,
  Modal,
} from "@/cala/components/ui/primitives";
import type { Automation, Role } from "@/cala/domain/model";
import { roleLabels } from "@/cala/domain/identity/permissions";

const triggers: Record<Automation["trigger"], string> = {
  "reservation.created": "Reserva nueva (confirmada)",
  "reservation.cancelled": "Reserva cancelada",
  "checkin.completed": "Check-in realizado",
  "checkout.completed": "Check-out realizado",
};
/** What each role gets to hear about (shown under the checkboxes). */
const roleHints: Partial<Record<Role, string>> = {
  housekeeping: "Ve tareas y unidades, nunca datos del huésped.",
  front_desk: "Reservas, huéspedes y tareas.",
  finance: "Solo pagos y finanzas.",
};
const notifiable: Role[] = ["owner", "admin", "manager", "front_desk", "housekeeping", "finance", "viewer"];

type Draft = {
  name: string;
  trigger: Automation["trigger"];
  action: Automation["action"];
  enabled: boolean;
  notifyRoles: Role[];
  onlyIfPending: boolean;
  taskTitle: string;
  taskKind: "housekeeping" | "maintenance";
  assigneeId: string;
};

const example: Draft = {
  name: "Limpieza tras check-out",
  trigger: "checkout.completed",
  action: "create_task",
  enabled: true,
  notifyRoles: ["housekeeping"],
  onlyIfPending: true,
  taskTitle: "Limpieza de salida",
  taskKind: "housekeeping",
  assigneeId: "",
};

function draftOf(rule: Automation): Draft {
  return {
    name: rule.name,
    trigger: rule.trigger,
    action: rule.action,
    enabled: rule.enabled,
    notifyRoles: rule.notifyRoles ?? [],
    onlyIfPending: rule.onlyIfPending ?? false,
    taskTitle: rule.taskTitle ?? "",
    taskKind: rule.taskKind ?? "housekeeping",
    assigneeId: rule.assigneeId ?? "",
  };
}

/** automation.save replaces every setting, so the pause toggle sends them all too. */
function payload(draft: Draft, id?: string) {
  return {
    type: "automation.save",
    ...(id ? { id } : {}),
    name: draft.name.trim(),
    trigger: draft.trigger,
    action: draft.action,
    enabled: draft.enabled,
    notifyRoles: draft.notifyRoles,
    onlyIfPending: draft.onlyIfPending,
    taskTitle: draft.action === "create_task" ? draft.taskTitle.trim() || null : null,
    taskKind: draft.taskKind,
    assigneeId: draft.action === "create_task" && draft.assigneeId ? draft.assigneeId : null,
  };
}

export function Automations() {
  const { data, command } = useWorkspace();
  const [editing, setEditing] = useState<{ id?: string; draft: Draft } | null>(null);
  const rules = data.automations.filter(
    (automation) => automation.propertyId === data.currentPropertyId,
  );
  const people = (id: string | null | undefined) => data.users.find((u) => u.id === id)?.name;
  return (
    <>
      <SectionTitle
        eyebrow="PEQUEÑAS ACCIONES, MENOS PENDIENTES"
        title="Automatizaciones"
        description="Reglas que reaccionan a tus reservas: crean tareas y avisan a quien corresponde, en la campana y como notificación del navegador."
      >
        <button className="button primary" onClick={() => setEditing({ draft: { ...example, name: "", taskTitle: "" } })}>
          <Icon name="plus" />
          Nueva regla
        </button>
      </SectionTitle>
      <div className="card-grid">
        {rules.map((automation) => {
          const roles = automation.notifyRoles ?? [];
          return (
            <div className="card automation-card" key={automation.id}>
              <div className="row between">
                <Icon name="automation" size={28} />
                <Badge status={automation.enabled ? "connected" : "disconnected"}>
                  {automation.enabled ? "Activa" : "Pausada"}
                </Badge>
              </div>
              <h3>{automation.name}</h3>
              <p>Cuando: {triggers[automation.trigger] ?? automation.trigger}</p>
              <p>
                Acción:{" "}
                {automation.action === "create_task"
                  ? `Crear tarea de ${automation.taskKind === "maintenance" ? "mantenimiento" : "limpieza"}${people(automation.assigneeId) ? ` para ${people(automation.assigneeId)}` : ""}`
                  : "Solo avisar"}
              </p>
              <p className="automation-notify">
                <Icon name="notification" size={16} />
                {roles.length
                  ? `Avisa a: ${roles.map((r) => roleLabels[r]).join(", ")}${automation.onlyIfPending ? " (si hay tareas por hacer)" : ""}`
                  : automation.action === "notify_team"
                    ? "Avisa a: Propietario, Administrador, Gerente"
                    : "Sin notificaciones"}
              </p>
              <div className="card-actions">
                <button
                  className="button secondary"
                  onClick={() => setEditing({ id: automation.id, draft: draftOf(automation) })}
                >
                  Editar regla
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    void command(
                      payload({ ...draftOf(automation), enabled: !automation.enabled }, automation.id),
                    ).catch(() => {})
                  }
                >
                  {automation.enabled ? "Pausar" : "Activar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!rules.length && (
        <>
          <Empty
            title="Dale continuidad a tu operación"
            description="Por ejemplo: cada check-out crea la limpieza de la habitación y avisa a Limpieza en su teléfono."
          />
          <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button className="button secondary" onClick={() => setEditing({ draft: example })}>
              Usar este ejemplo
            </button>
          </div>
        </>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Editar automatización" : "Nueva automatización"}
          onClose={() => setEditing(null)}
        >
          <RuleForm
            initial={editing.draft}
            team={data.users}
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              await command(payload(draft, editing.id));
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function RuleForm({
  initial,
  team,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  team: { id: string; name: string }[];
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleRole = (role: Role) =>
    set("notifyRoles", draft.notifyRoles.includes(role) ? draft.notifyRoles.filter((r) => r !== role) : [...draft.notifyRoles, role]);
  return (
    <form
      className="form automation-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (!draft.name.trim()) return setError("Ponle un nombre a la regla.");
        setBusy(true);
        setError("");
        try {
          await onSubmit(draft);
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo guardar.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label className="field field-full">
          <span>Nombre de la regla *</span>
          <input value={draft.name} maxLength={120} required onChange={(e) => set("name", e.target.value)} placeholder="Limpieza tras check-out" />
        </label>
        <label className="field">
          <span>Cuando ocurra *</span>
          <select value={draft.trigger} onChange={(e) => set("trigger", e.target.value as Draft["trigger"])}>
            {Object.entries(triggers).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Realizar esta acción *</span>
          <select value={draft.action} onChange={(e) => set("action", e.target.value as Draft["action"])}>
            <option value="create_task">Crear una tarea y avisar</option>
            <option value="notify_team">Solo avisar</option>
          </select>
        </label>
        {draft.action === "create_task" && (
          <>
            <label className="field">
              <span>Tipo de tarea</span>
              <select value={draft.taskKind} onChange={(e) => set("taskKind", e.target.value as Draft["taskKind"])}>
                <option value="housekeeping">Limpieza</option>
                <option value="maintenance">Mantenimiento</option>
              </select>
            </label>
            <label className="field">
              <span>Título de la tarea</span>
              <input value={draft.taskTitle} maxLength={120} placeholder={draft.name || "Limpieza de salida"} onChange={(e) => set("taskTitle", e.target.value)} />
            </label>
            <label className="field field-full">
              <span>Asignar la tarea a</span>
              <select value={draft.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
                <option value="">Sin asignar (la toma quien esté disponible)</option>
                {team.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <fieldset className="field-full automation-roles">
          <legend>Avisar a (campana y notificación del navegador)</legend>
          <div className="automation-role-grid">
            {notifiable.map((role) => (
              <label key={role} className="automation-role">
                <input type="checkbox" checked={draft.notifyRoles.includes(role)} onChange={() => toggleRole(role)} />
                <span>
                  <strong>{roleLabels[role]}</strong>
                  {roleHints[role] && <small>{roleHints[role]}</small>}
                </span>
              </label>
            ))}
          </div>
          <small className="muted">
            {draft.notifyRoles.length
              ? "Solo recibe el aviso quien tenga ese rol y acceso a esta propiedad. Los roles sin acceso a datos de huéspedes ven el aviso sin nombres."
              : draft.action === "notify_team"
                ? "Sin roles elegidos se avisa a Propietario, Administrador y Gerente."
                : "Sin roles elegidos la regla solo crea la tarea (quien la tenga asignada recibe su aviso)."}
          </small>
        </fieldset>
        <label className="field checkbox field-full">
          <span>Avisar solo si la habitación tiene tareas por hacer (limpiar, reparar…)</span>
          <input type="checkbox" checked={draft.onlyIfPending} onChange={(e) => set("onlyIfPending", e.target.checked)} />
        </label>
        <label className="field checkbox field-full">
          <span>Regla activa</span>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        </label>
      </div>
      <div className="notice">
        Las acciones se ejecutan una sola vez por reserva y evento. No se permiten operaciones financieras automáticas.
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? (
            <>
              <Icon name="spinner" /> Guardando…
            </>
          ) : (
            "Guardar regla"
          )}
        </button>
      </div>
    </form>
  );
}
