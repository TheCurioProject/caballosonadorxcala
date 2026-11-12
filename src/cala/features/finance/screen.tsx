"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Badge,
  Empty,
} from "@/cala/components/ui/primitives";
import { guestName } from "@/cala/features/reservations/components";
import { money, dateTime, shortDate } from "@/cala/lib/format";
import { summarizePayments } from "@/cala/domain/reservations/payments";
import { FinanceOverview } from "./overview";
import { ReservationPayments, reservationTotal } from "./payments";

export function Finance() {
  const params = useSearchParams();
  const initial = params.get("reservation");
  const [tab, setTab] = useState<"overview" | "folios">(
    initial ? "folios" : "overview",
  );
  const [selected, setSelected] = useState(initial ?? "");
  const { t } = useI18n();
  return (
    <>
      <SectionTitle
        eyebrow="CADA MOVIMIENTO, CLARO"
        title="Finanzas"
        description="Ingresos, ocupación, cobros y saldos de todas tus propiedades. Registra anticipos, pagos y depósitos en cada reserva."
      />
      <div className="tabs finance-tabs" aria-label={t("Secciones de finanzas")}>
        <button
          className={tab === "overview" ? "active" : ""}
          aria-pressed={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          <Icon name="reports" size={16} />
          {t("Resumen")}
        </button>
        <button
          className={tab === "folios" ? "active" : ""}
          aria-pressed={tab === "folios"}
          onClick={() => setTab("folios")}
        >
          <Icon name="payment" size={16} />
          {t("Folios y pagos")}
        </button>
      </div>
      {tab === "overview" ? (
        <FinanceOverview
          onOpenReservation={(id) => {
            setSelected(id);
            setTab("folios");
          }}
        />
      ) : (
        <Folios selected={selected} setSelected={setSelected} />
      )}
    </>
  );
}

function Folios({
  selected,
  setSelected,
}: {
  selected: string;
  setSelected: (id: string) => void;
}) {
  const { data, can, command } = useWorkspace();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "due" | "current">("all");
  const [action, setAction] = useState<"charge" | null>(null);
  const multi = data.properties.length > 1;
  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "";
  const reservations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.reservations
      .filter((r) => {
        if (filter === "current" && r.propertyId !== data.currentPropertyId)
          return false;
        if (filter === "due") {
          if (["cancelled", "no_show", "draft"].includes(r.status)) return false;
          const paid = summarizePayments(
            data.payments.filter((p) => p.reservationId === r.id),
          ).paidMinor;
          if (reservationTotal(data, r) - paid <= 0) return false;
        }
        if (!q) return true;
        return (
          guestName(data.guests, r.guestId).toLowerCase().includes(q) ||
          r.confirmationCode.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.arrival.localeCompare(a.arrival));
  }, [data, query, filter]);
  const r =
    data.reservations.find((x) => x.id === selected) ?? reservations[0];
  const listRef = useRef<HTMLDivElement>(null);
  const activeId = r?.id;
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("button.active")
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);
  const items = r ? data.folioItems.filter((i) => i.reservationId === r.id) : [];
  return (
    <>
      {!data.reservations.length ? (
        <Empty
          title="Sin folios todavía"
          description="Los folios se crean al registrar una reserva."
        />
      ) : (
        <div className="split">
          <div className="panel split-list" ref={listRef}>
            <div className="folio-search">
              <label className="field">
                <span className="sr-only">{t("Buscar huésped o código")}</span>
                <input
                  type="search"
                  placeholder={t("Huésped o código de reserva")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                aria-label={t("Filtrar folios")}
              >
                <option value="all">{t("Todas las reservas")}</option>
                <option value="due">{t("Con saldo pendiente")}</option>
                {multi && (
                  <option value="current">{t("Solo esta propiedad")}</option>
                )}
              </select>
            </div>
            {reservations.map((x) => (
              <button
                key={x.id}
                className={r?.id === x.id ? "active" : ""}
                onClick={() => setSelected(x.id)}
              >
                <strong data-no-translate>{guestName(data.guests, x.guestId)}</strong>
                <small>
                  {x.confirmationCode} · {shortDate(x.arrival)}
                  {multi ? ` · ${propertyName(x.propertyId)}` : ""}
                </small>
              </button>
            ))}
            {!reservations.length && (
              <p className="muted padded">{t("Ninguna reserva coincide.")}</p>
            )}
          </div>
          {r && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">FOLIO {r.confirmationCode}</p>
                  <h2 data-no-translate>{guestName(data.guests, r.guestId)}</h2>
                  <p className="muted">
                    {shortDate(r.arrival)} → {shortDate(r.departure)}
                    {multi ? ` · ${propertyName(r.propertyId)}` : ""}
                  </p>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="padded">
                <ReservationPayments reservation={r} key={r.id} />
              </div>
              <div className="panel-heading">
                <h2>{t("Cargos del folio")}</h2>
                {can("finance.write") && (
                  <button
                    className="button secondary"
                    onClick={() => setAction("charge")}
                  >
                    <Icon name="plus" />
                    {t("Agregar cargo")}
                  </button>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Concepto")}</th>
                      <th>{t("Fecha")}</th>
                      <th className="align-right">{t("Importe")}</th>
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
                    {!items.length && (
                      <tr>
                        <td colSpan={3} className="muted">
                          {t("Precio acordado")}: {money(r.totalMinor, r.currency)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                propertyId: r.propertyId,
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
