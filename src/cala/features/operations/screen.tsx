"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Badge,
  Modal,
  Form,
  Empty,
} from "@/cala/components/ui/primitives";
import type { Task } from "@/cala/domain/model";
export function Operations({ kind }: { kind: "housekeeping" | "maintenance" }) {
  const { data, can, command } = useWorkspace();
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [filter, setFilter] = useState("all");
  const units = data.units.filter(
    (u) => u.propertyId === data.currentPropertyId,
  );
  const tasks = data.tasks.filter(
    (t) =>
      t.propertyId === data.currentPropertyId &&
      t.kind === kind &&
      (filter === "all" || t.status === filter),
  );
  const t = editing && editing !== "new" ? editing : null;
  return (
    <>
      <SectionTitle
        eyebrow="LOS DETALLES HACEN LA DIFERENCIA"
        title={kind === "housekeeping" ? "Housekeeping" : "Mantenimiento"}
        description={
          kind === "housekeeping"
            ? "Habitaciones preparadas. Llegadas sin pendientes."
            : "Cuida cada espacio y da seguimiento a lo que necesita atención."
        }
      >
        {can("operations.write") && (
          <button className="button primary" onClick={() => setEditing("new")}>
            <Icon name="plus" />
            Nueva tarea
          </button>
        )}
      </SectionTitle>
      {kind === "housekeeping" && (
        <div className="card-grid" style={{ marginBottom: 28 }}>
          {units.map((u) => (
            <div className="card" key={u.id}>
              <div className="row between">
                <Icon
                  name={
                    u.housekeeping === "dirty" ? "dirty-room" : "clean-room"
                  }
                  size={27}
                />
                <Badge status={u.housekeeping} />
              </div>
              <h3>{u.name}</h3>
              <p>
                {
                  data.inventoryTypes.find((t) => t.id === u.inventoryTypeId)
                    ?.name
                }
              </p>
              {can("operations.write") && (
                <label className="field">
                  <span>Estado operativo</span>
                  <select
                    value={u.housekeeping}
                    onChange={(e) =>
                      void command({
                        type: "unit.clean",
                        id: u.id,
                        status: e.target.value,
                        version: u.version,
                      }).catch(() => {})
                    }
                  >
                    <option value="dirty">Por limpiar</option>
                    <option value="clean">Limpia</option>
                    <option value="inspected">Inspeccionada</option>
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="panel">
        <div className="panel-heading">
          <h2>Tareas del equipo</h2>
          <select
            aria-label="Filtrar tareas"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En proceso</option>
            <option value="completed">Completadas</option>
          </select>
        </div>
        {tasks.length ? (
          tasks.map((t) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>{t.title}</strong>
                <p>
                  {units.find((u) => u.id === t.unitId)?.name ?? "Propiedad"} ·{" "}
                  {data.users.find((u) => u.id === t.assigneeId)?.name ??
                    "Sin asignar"}
                  {t.priority === "high" ? " · Prioridad alta" : ""}
                </p>
              </div>
              <div className="row">
                <Badge status={t.status} />
                {can("operations.write") && (
                  <button
                    className="button secondary"
                    onClick={() => setEditing(t)}
                  >
                    Gestionar
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="Sin tareas en esta vista"
            description="Agrega una tarea o cambia el filtro para ver las demás."
          />
        )}
      </div>
      {editing && (
        <Modal
          title={t ? "Gestionar tarea" : "Nueva tarea"}
          onClose={() => setEditing(null)}
        >
          <Form
            fields={[
              { name: "title", label: "Qué necesita hacerse", value: t?.title },
              {
                name: "unitId",
                label: "Unidad",
                type: "select",
                value: t?.unitId ?? "",
                required: false,
                options: [
                  { value: "", label: "Propiedad / área común" },
                  ...units.map((u) => ({ value: u.id, label: u.name })),
                ],
              },
              {
                name: "status",
                label: "Estado",
                type: "select",
                value: t?.status ?? "pending",
                options: [
                  { value: "pending", label: "Pendiente" },
                  { value: "in_progress", label: "En proceso" },
                  { value: "completed", label: "Completada" },
                ],
              },
              {
                name: "priority",
                label: "Prioridad",
                type: "select",
                value: t?.priority ?? "normal",
                options: [
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "Alta" },
                ],
              },
              {
                name: "assigneeId",
                label: "Responsable",
                type: "select",
                value: t?.assigneeId ?? "",
                required: false,
                options: [
                  { value: "", label: "Sin asignar" },
                  ...data.users.map((u) => ({ value: u.id, label: u.name })),
                ],
              },
            ]}
            onCancel={() => setEditing(null)}
            onSubmit={async (v) => {
              await command({
                type: "task.save",
                ...v,
                kind,
                unitId: v.unitId || null,
                assigneeId: v.assigneeId || null,
                ...(t ? { id: t.id, version: t.version } : {}),
              });
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
