"use client";
import { useState } from "react";
import { Modal, Form, Badge } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { dayDistance, unitOccupancy } from "@/cala/domain/calendar/layout";
import type { Reservation } from "@/cala/domain/model";
import { money, shortDate } from "@/cala/lib/format";
import { guestName, ReservationForm } from "./components";
export type CalendarRange = {
  unitId: string;
  arrival: string;
  departure: string;
  /** Skip the chooser and open the reservation or block form directly. */
  intent?: "reservation" | "block";
};

export function CalendarRangeDialog({
  range,
  onClose,
}: {
  range: CalendarRange;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const [mode, setMode] = useState<"choose" | "reservation" | "block">(
    range.intent ?? "choose",
  );
  const unit = data.units.find(
    (u) =>
      u.id === range.unitId &&
      u.propertyId === data.currentPropertyId &&
      u.active,
  );
  const held = unitOccupancy(
    data,
    range.unitId,
    range.arrival,
    range.departure,
  );
  const occupied =
    held.reservations.length > 0 ||
    held.blocks.length > 0 ||
    data.analyticsComplete === false;
  if (!unit)
    return (
      <Modal title="Unidad no disponible" onClose={onClose}>
        <p>La unidad cambió o ya no está activa. Actualiza el calendario.</p>
      </Modal>
    );
  if (mode === "reservation")
    return (
      <ReservationForm
        defaults={{
          unitId: range.unitId,
          arrival: range.arrival,
          departure: range.departure,
        }}
        onClose={onClose}
      />
    );
  if (mode === "block")
    return (
      <Modal title="Bloquear fechas" onClose={onClose}>
        <p>
          <strong>{unit.name}</strong> ·{" "}
          {data.properties.find((p) => p.id === unit.propertyId)?.name}
        </p>
        <Form
          fields={[
            {
              name: "arrival",
              label: "Desde",
              type: "date",
              value: range.arrival,
            },
            {
              name: "departure",
              label: "Primer día disponible",
              type: "date",
              value: range.departure,
              help: "Este día ya no forma parte del bloqueo.",
            },
            {
              name: "reason",
              label: "Motivo",
              value: "Mantenimiento",
              maxLength: 160,
            },
          ]}
          submit="Confirmar bloqueo"
          onCancel={onClose}
          onSubmit={async (values) => {
            await commandForBlock(values);
            onClose();
          }}
        />
      </Modal>
    );
  return (
    <Modal title="Fechas seleccionadas" onClose={onClose}>
      <p>
        <strong>{unit.name}</strong> ·{" "}
        {data.properties.find((p) => p.id === unit.propertyId)?.name}
      </p>
      <p>
        {shortDate(range.arrival)} — {shortDate(range.departure)} ·{" "}
        {dayDistance(range.arrival, range.departure)} noches
      </p>
      {occupied && (
        <p className="notice warning" role="alert">
          Hay reservas o bloqueos en este rango, o la lectura está incompleta.
          Revisa el calendario antes de continuar.
        </p>
      )}
      <div className="form-actions">
        {can("reservation.write") && (
          <button
            className="button primary"
            disabled={occupied}
            onClick={() => setMode("reservation")}
          >
            Añadir reserva
          </button>
        )}
        {can("inventory.write") && (
          <button
            className="button secondary"
            disabled={occupied}
            onClick={() => setMode("block")}
          >
            Bloquear fechas
          </button>
        )}
      </div>
    </Modal>
  );
  async function commandForBlock(
    values: Record<string, string | number | boolean>,
  ) {
    await command({ type: "block.create", unitId: range.unitId, ...values });
  }
}

export function CalendarBlockInfo({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const block = data.blocks.find(
    (b) => b.id === id && b.propertyId === data.currentPropertyId,
  );
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Detalle del bloqueo"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {!block ? (
        <p>El bloqueo ya no está disponible.</p>
      ) : (
        <>
          <h3>{data.units.find((u) => u.id === block.unitId)?.name}</h3>
          <p>{block.reason}</p>
          <p>
            {shortDate(block.arrival)} — {shortDate(block.departure)}. El último
            día vuelve a estar disponible.
          </p>
          {!block.active && (
            <p className="notice">Este bloqueo ya se liberó.</p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {block.active &&
            can("inventory.write") &&
            (!confirm ? (
              <button
                className="button secondary"
                onClick={() => setConfirm(true)}
              >
                Liberar fechas
              </button>
            ) : (
              <div className="notice warning">
                <p>
                  Las fechas volverán a estar disponibles si no hay otra reserva
                  o bloqueo.
                </p>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await command({ type: "block.release", id: block.id });
                      onClose();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "No se pudo liberar.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar liberación
                </button>
              </div>
            ))}
        </>
      )}
    </Modal>
  );
}

export function CalendarQuickView({
  reservation,
  onClose,
  onOpen,
  onMove,
}: {
  reservation: Reservation;
  onClose: () => void;
  onOpen: () => void;
  onMove: () => void;
}) {
  const { data, can, command } = useWorkspace();
  const [edit, setEdit] = useState(false),
    [cancel, setCancel] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const r = reservation,
    stale = data.reservations.find((x) => x.id === r.id)?.version !== r.version;
  if (edit) return <ReservationForm reservation={r} onClose={onClose} />;
  return (
    <Modal
      title="Resumen de la estancia"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h3>{guestName(data.guests, r.guestId)}</h3>
      <Badge status={r.status} />
      <dl className="details">
        <div>
          <dt>Propiedad</dt>
          <dd>{data.properties.find((p) => p.id === r.propertyId)?.name}</dd>
        </div>
        <div>
          <dt>Unidad</dt>
          <dd>
            {data.units.find((u) => u.id === r.unitId)?.name ?? "Por asignar"}
          </dd>
        </div>
        <div>
          <dt>Llegada y salida</dt>
          <dd>
            {shortDate(r.arrival)} — {shortDate(r.departure)}
          </dd>
        </div>
        <div>
          <dt>Estancia</dt>
          <dd>
            {dayDistance(r.arrival, r.departure)} noches ·{" "}
            {r.adults + r.children} huéspedes
          </dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>
            {r.source} · {r.confirmationCode}
          </dd>
        </div>
        {can("finance.read") && (
          <div>
            <dt>Alojamiento acordado</dt>
            <dd>{money(r.totalMinor, r.currency)}</dd>
          </div>
        )}
      </dl>
      {stale && (
        <p className="notice warning" role="alert">
          La reserva cambió. Cierra este resumen y vuelve a abrirla para revisar
          los datos actuales.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" onClick={onOpen}>
          Ver todos los detalles
        </button>
        {can("reservation.write") &&
          ["pending", "confirmed"].includes(r.status) && (
            <button
              className="button secondary"
              disabled={stale}
              onClick={() => setEdit(true)}
            >
              Editar reserva
            </button>
          )}
        {can("reservation.write") &&
          ["pending", "confirmed", "checked_in"].includes(r.status) && (
            <button
              className="button secondary"
              disabled={stale}
              onClick={onMove}
            >
              Mover estancia
            </button>
          )}
        {can("reservation.cancel") &&
          ["draft", "pending", "confirmed"].includes(r.status) && (
            <button
              className="button secondary"
              disabled={stale}
              onClick={() => setCancel(true)}
            >
              Cancelar reserva
            </button>
          )}
      </div>
      {cancel && (
        <div className="notice warning">
          <p>
            Se cancelará esta reserva y se liberará su inventario. Esta acción
            queda en el historial.
          </p>
          <button
            className="button danger"
            disabled={busy || stale}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await command({
                  type: "reservation.transition",
                  id: r.id,
                  version: r.version,
                  status: "cancelled",
                });
                onClose();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo cancelar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar cancelación
          </button>
        </div>
      )}
    </Modal>
  );
}
