"use client";
import { useId, useState } from "react";
import { Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "./context";
import {
  defaultWorkspacePreferences,
  workspacePreferences,
  type WorkspacePreferences,
} from "@/cala/domain/workspace/preferences";
export function CustomizeWorkspace({
  section,
  onClose,
  onApply,
  calendar,
}: {
  section: "calendar" | "dashboard";
  onClose: () => void;
  onApply?: (value: WorkspacePreferences) => void;
  calendar?: Partial<WorkspacePreferences["calendar"]>;
}) {
  const fieldId = useId();
  const { data, command, can } = useWorkspace();
  const saved = data.workspacePreferences?.find(
    (p) =>
      p.organizationId === data.currentOrganizationId &&
      p.userId === data.currentUser.id,
  );
  const [version] = useState(saved?.version ?? 0);
  const [draft, setDraft] = useState(() => {
    const value = workspacePreferences(saved?.preferences);
    return { ...value, calendar: { ...value.calendar, ...calendar } };
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stale = (saved?.version ?? 0) !== version;
  const fields =
    section === "calendar"
      ? ([
          ["stickyUnits", "Mantener fija la columna de unidades"],
          ["guest", "Nombre del huésped"],
          ["channel", "Canal de origen"],
          ["guests", "Número de huéspedes"],
          ["price", "Importe de alojamiento"],
          ["nights", "Número de noches"],
          ["tooltip", "Resumen al señalar la estancia"],
        ] as const)
      : ([
          ["metrics", "Indicadores"],
          ["daily", "Llegadas, salidas y estancias"],
          ["activity", "Actividad reciente"],
          ["setup", "Progreso de configuración"],
        ] as const);
  return (
    <Modal
      title={
        section === "calendar"
          ? "Personalizar calendario"
          : "Personalizar Inicio"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        Estas preferencias se guardan en tu cuenta para los dispositivos en los
        que inicies sesión.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || stale) return;
          setBusy(true);
          setError("");
          try {
            await command({
              type: "workspace.preferences.save",
              organizationId: data.currentOrganizationId,
              version,
              preferences: draft,
            });
            onApply?.(draft);
            onClose();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "No pudimos guardar las preferencias.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {section === "calendar" && (
          <div className="form-grid">
            <label className="field">
              <span id={`${fieldId}-view`}>Vista inicial</span>
              <select
                aria-labelledby={`${fieldId}-view`}
                disabled={busy}
                value={draft.calendar.view}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    calendar: {
                      ...d.calendar,
                      view: e.target
                        .value as WorkspacePreferences["calendar"]["view"],
                    },
                  }))
                }
              >
                <option value="timeline">Habitaciones por fecha</option>
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
              </select>
            </label>
            <label className="field">
              <span id={`${fieldId}-scope`}>Propiedades visibles</span>
              <select
                aria-labelledby={`${fieldId}-scope`}
                disabled={busy}
                value={draft.calendar.scope}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    calendar: {
                      ...d.calendar,
                      scope: e.target
                        .value as WorkspacePreferences["calendar"]["scope"],
                    },
                  }))
                }
              >
                <option value="property">Propiedad actual</option>
                <option value="organization">Todas mis propiedades</option>
              </select>
            </label>
            <label className="field">
              <span id={`${fieldId}-days`}>Días en la línea de tiempo</span>
              <select
                aria-labelledby={`${fieldId}-days`}
                disabled={busy}
                value={draft.calendar.days}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    calendar: {
                      ...d.calendar,
                      days: Number(
                        e.target.value,
                      ) as WorkspacePreferences["calendar"]["days"],
                    },
                  }))
                }
              >
                {[7, 14, 30, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} días
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="customize-options">
          {fields.map(([key, label]) => (
            <label className="checkbox-label" key={key}>
              <input
                type="checkbox"
                disabled={busy || (key === "price" && !can("finance.read"))}
                checked={Boolean(
                  (draft[section] as Record<string, unknown>)[key],
                )}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [section]: { ...d[section], [key]: e.target.checked },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        {stale && (
          <p className="notice warning" role="alert">
            Otra sesión guardó cambios. Vuelve a abrir la personalización antes
            de guardar.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                [section]: structuredClone(
                  defaultWorkspacePreferences[section],
                ),
              }))
            }
          >
            Restaurar valores iniciales
          </button>
          <button className="button primary" disabled={busy || stale}>
            {busy ? "Guardando…" : "Guardar preferencias"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
