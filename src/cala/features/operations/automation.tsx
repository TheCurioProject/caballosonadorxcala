"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Form,
  Badge,
  Empty,
  Icon,
  Modal,
} from "@/cala/components/ui/primitives";
import type { Automation } from "@/cala/domain/model";

export function Automations() {
  const { data, command } = useWorkspace();
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const rules = data.automations.filter(
    (automation) => automation.propertyId === data.currentPropertyId,
  );
  const rule = editing && editing !== "new" ? editing : null;
  return (
    <>
      <SectionTitle
        eyebrow="PEQUEÑAS ACCIONES, MENOS PENDIENTES"
        title="Automatizaciones"
        description="Reglas deterministas que reaccionan a los eventos de tu operación."
      >
        <button className="button primary" onClick={() => setEditing("new")}>
          <Icon name="plus" />
          Nueva regla
        </button>
      </SectionTitle>
      <div className="card-grid">
        {rules.map((automation) => (
          <div className="card" key={automation.id}>
            <div className="row between">
              <Icon name="automation" size={28} />
              <Badge status={automation.enabled ? "connected" : "disconnected"}>
                {automation.enabled ? "Activa" : "Pausada"}
              </Badge>
            </div>
            <h3>{automation.name}</h3>
            <p>Cuando: {automation.trigger}</p>
            <p>
              Acción:{" "}
              {automation.action === "create_task"
                ? "Crear tarea de limpieza"
                : "Notificar al equipo en auditoría"}
            </p>
            <div className="card-actions">
              <button
                className="button secondary"
                onClick={() => setEditing(automation)}
              >
                Editar regla
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  void command({
                    type: "automation.save",
                    id: automation.id,
                    name: automation.name,
                    trigger: automation.trigger,
                    action: automation.action,
                    enabled: !automation.enabled,
                  }).catch(() => {})
                }
              >
                {automation.enabled ? "Pausar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!rules.length && (
        <Empty
          title="Dale continuidad a tu operación"
          description="Crea una regla para responder a un evento de reservas."
        />
      )}
      {editing && (
        <Modal
          title={rule ? "Editar automatización" : "Nueva automatización"}
          onClose={() => setEditing(null)}
        >
          <Form
            fields={[
              { name: "name", label: "Nombre de la regla", value: rule?.name },
              {
                name: "trigger",
                label: "Cuando ocurra",
                type: "select",
                value: rule?.trigger ?? "checkout.completed",
                options: [
                  {
                    value: "checkout.completed",
                    label: "Check-out completado",
                  },
                  { value: "reservation.created", label: "Reserva creada" },
                  {
                    value: "reservation.cancelled",
                    label: "Reserva cancelada",
                  },
                ],
              },
              {
                name: "action",
                label: "Realizar esta acción",
                type: "select",
                value: rule?.action ?? "create_task",
                options: [
                  { value: "create_task", label: "Crear tarea de limpieza" },
                  {
                    value: "notify_team",
                    label: "Registrar notificación al equipo",
                  },
                ],
              },
              {
                name: "enabled",
                label: "Regla activa",
                type: "checkbox",
                value: rule?.enabled ?? true,
              },
            ]}
            onSubmit={async (values) => {
              await command({
                type: "automation.save",
                ...values,
                ...(rule ? { id: rule.id } : {}),
              });
              setEditing(null);
            }}
          />
          <div className="notice">
            Las acciones son idempotentes. No se permiten operaciones
            financieras automáticas.
          </div>
        </Modal>
      )}
    </>
  );
}
