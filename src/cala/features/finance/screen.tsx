"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Badge,
  Empty,
  fitChars,
} from "@/cala/components/ui/primitives";
import { guestName } from "@/cala/features/reservations/components";
import { money, dateTime } from "@/cala/lib/format";
export function Finance() {
  const { data, can, command } = useWorkspace();
  const params = useSearchParams();
  const reservations = data.reservations.filter(
    (r) => r.propertyId === data.currentPropertyId,
  );
  const [selected, setSelected] = useState(
    params.get("reservation") ?? reservations[0]?.id ?? "",
  );
  const [action, setAction] = useState<"charge" | null>(null);
  const r = reservations.find((r) => r.id === selected);
  const items = data.folioItems.filter((i) => i.reservationId === selected);
  const payments = data.payments.filter((p) => p.reservationId === selected);
  const total = items.reduce((a, b) => a + b.amountMinor, 0),
    paid = payments
      .filter((p) => p.status === "succeeded")
      .reduce((a, b) => a + b.amountMinor, 0);
  return (
    <>
      <SectionTitle
        eyebrow="CADA MOVIMIENTO, CLARO"
        title="Finanzas"
        description="Folios, cargos y saldos. Trazabilidad desde el primer pago hasta el último ajuste."
      />
      {!reservations.length ? (
        <Empty
          title="Sin folios todavía"
          description="Los folios se crean al registrar una reserva."
        />
      ) : (
        <div className="split">
          <div className="panel split-list">
            {reservations.map((r) => (
              <button
                key={r.id}
                className={selected === r.id ? "active" : ""}
                onClick={() => setSelected(r.id)}
              >
                <strong>{guestName(data.guests, r.guestId)}</strong>
                <small>
                  {r.confirmationCode} · {r.arrival}
                </small>
              </button>
            ))}
          </div>
          {r && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">FOLIO {r.confirmationCode}</p>
                  <h2>{guestName(data.guests, r.guestId)}</h2>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="folio-totals padded">
                {[
                  ["Cargos", total],
                  ["Pagado neto", paid],
                  ["Saldo", total - paid],
                ].map(([label, value]) => (
                  <div className="folio-total" key={label}>
                    <p className="eyebrow">{label}</p>
                    <strong
                      className="mono"
                      style={fitChars(money(Number(value), r.currency))}
                    >
                      {money(Number(value), r.currency)}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="toolbar">
                {can("finance.write") && (
                  <button
                    className="button secondary"
                    onClick={() => setAction("charge")}
                  >
                    <Icon name="plus" />
                    Agregar cargo
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Fecha</th>
                      <th className="align-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.description}</td>
                        <td>{dateTime(i.createdAt)}</td>
                        <td className="align-right mono">
                          {money(i.amountMinor, r.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-heading">
                <h2>Pagos</h2>
              </div>
              {payments.map((p) => (
                <div className="list-row" key={p.id}>
                  <div>
                    <strong>Pago · {money(p.amountMinor, r.currency)}</strong>
                    <p>{dateTime(p.createdAt)}</p>
                  </div>
                  <Badge status={p.status} />
                </div>
              ))}
              {!payments.length && (
                <p className="muted padded">Este folio aún no tiene pagos.</p>
              )}
            </div>
          )}
        </div>
      )}
      {action && r && (
        <Modal title="Agregar cargo" onClose={() => setAction(null)}>
          <Form
            fields={[
              {
                name: "description",
                label: "Concepto",
                value: "Servicio adicional",
              },
              {
                name: "amountMinor",
                label: "Importe",
                type: "money",
                min: 1,
                value: 10000,
                help: "Importe en la moneda de la propiedad; hasta dos decimales.",
              },
            ]}
            onCancel={() => setAction(null)}
            submit="Agregar cargo"
            onSubmit={async (v) => {
              await command({
                type: "folio.charge",
                ...v,
                reservationId: r.id,
              });
              setAction(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
