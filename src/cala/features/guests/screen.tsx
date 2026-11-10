"use client";
import { useState } from "react";
import { Empty, Modal, SectionTitle } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  GuestEditor,
  ReservationTable,
  ReservationInspector,
} from "@/cala/features/reservations/components";
import type { Guest } from "@/cala/domain/model";
export function Guests() {
  const { data, can } = useWorkspace();
  const [search, setSearch] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [selected, setSelected] = useState<Guest | null>(null);
  const [editing, setEditing] = useState<Guest | "new" | null>(null);
  const [reservation, setReservation] = useState<string | null>(null);
  const stayCount = (id: string) =>
    data.reservations.filter(
      (r) =>
        r.guestId === id &&
        !["draft", "cancelled", "no_show"].includes(r.status),
    ).length;
  const guests = data.guests
    .filter(
      (g) =>
        (!repeat || stayCount(g.id) > 1) &&
        `${g.firstName} ${g.lastName} ${g.email} ${g.phone} ${g.company ?? ""} ${g.city ?? ""}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
  const current = selected
    ? data.guests.find((g) => g.id === selected.id)
    : undefined;
  return (
    <>
      <SectionTitle
        eyebrow="CONOCE A QUIENES VUELVEN"
        title="Huéspedes"
        description="Contactos e historial de estancias de las propiedades a las que tienes acceso."
      >
        {can("reservation.write") && (
          <button className="button primary" onClick={() => setEditing("new")}>
            Nuevo huésped
          </button>
        )}
      </SectionTitle>
      <div className="panel">
        <div className="toolbar">
          <label className="field">
            <span>Buscar huésped</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo o teléfono"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.target.checked)}
            />
            Huéspedes recurrentes
          </label>
          <span className="muted">{guests.length} contactos</span>
        </div>
        {guests.length ? (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Contactos de huéspedes"
          >
            <table className="guest-table">
              <thead>
                <tr>
                  <th>Huésped</th>
                  <th>Contacto</th>
                  <th>País</th>
                  <th>Estancias</th>
                  <th>Perfil</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id}>
                    <td data-label="Huésped">
                      {g.firstName} {g.lastName}
                    </td>
                    <td data-label="Contacto">
                      {g.email || "Sin correo"}
                      <small className="table-sub">{g.phone}</small>
                    </td>
                    <td data-label="País">{g.country}</td>
                    <td data-label="Estancias">{stayCount(g.id)}</td>
                    <td data-label="Perfil">
                      <button
                        className="button secondary"
                        onClick={() => setSelected(g)}
                      >
                        Ver perfil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            asset="empty-guests"
            title="Sin huéspedes para mostrar"
            description="Los contactos se guardan cuando registras una reserva. También puedes crear uno manualmente."
          />
        )}
      </div>
      {current && !reservation && !editing && (
        <Modal
          title={`${current.firstName} ${current.lastName}`}
          onClose={() => setSelected(null)}
          wide
        >
          <dl className="details">
            <div>
              <dt>Correo</dt>
              <dd>{current.email || "Sin correo"}</dd>
            </div>
            <div>
              <dt>Teléfono</dt>
              <dd>{current.phone || "Sin teléfono"}</dd>
            </div>
            <div>
              <dt>País</dt>
              <dd>{current.country}</dd>
            </div>
          </dl>
          <dl className="details">
            <div>
              <dt>Empresa</dt>
              <dd>{current.company || "Sin empresa"}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>
                {[
                  current.address,
                  current.city,
                  current.region,
                  current.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ") || "Sin dirección"}
              </dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>{current.language || "Sin especificar"}</dd>
            </div>
          </dl>
          {current.notes && (
            <div className="notice">
              <strong>Notas autorizadas</strong>
              <p className="guest-notes">{current.notes}</p>
            </div>
          )}
          {can("reservation.write") && (
            <button
              className="button secondary"
              onClick={() => setEditing({ ...current })}
            >
              Editar datos
            </button>
          )}
          <h3>Historial de estancias</h3>
          <ReservationTable
            reservations={data.reservations.filter(
              (r) => r.guestId === current.id,
            )}
            onSelect={setReservation}
          />
        </Modal>
      )}
      {editing && (
        <GuestEditor
          guest={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {reservation && (
        <ReservationInspector
          id={reservation}
          onClose={() => setReservation(null)}
        />
      )}
    </>
  );
}
