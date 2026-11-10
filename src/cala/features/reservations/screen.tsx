"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkspace } from "@/cala/features/workspace/context";
import { SectionTitle, Icon } from "@/cala/components/ui/primitives";
import {
  ReservationTable,
  ReservationInspector,
  ReservationForm,
  guestName,
} from "./components";
import { useI18n } from "@/cala/lib/i18n";
export function Reservations() {
  const { data, can } = useWorkspace();
  const { t } = useI18n();
  const params = useSearchParams();
  const [create, setCreate] = useState(params.get("new") === "1");
  const [selected, setSelected] = useState<string | null>(
    params.get("reservation"),
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const reservations = data.reservations
    .filter(
      (r) =>
        r.propertyId === data.currentPropertyId &&
        (filter === "all" || r.status === filter) &&
        (guestName(data.guests, r.guestId) + " " + r.confirmationCode)
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.arrival.localeCompare(a.arrival));
  return (
    <>
      <SectionTitle
        eyebrow={t("CADA ESTANCIA CUENTA")}
        title={t("Reservas")}
        description={t(
          "Una vista clara, desde la primera noche hasta la despedida.",
        )}
      >
        {can("reservation.write") && (
          <button className="button primary" onClick={() => setCreate(true)}>
            <Icon name="plus" />
            {t("Nueva reserva")}
          </button>
        )}
      </SectionTitle>
      <div className="panel">
        <div className="toolbar">
          <label className="search-input">
            <Icon name="search" />
            <input
              aria-label={t("Buscar reservas")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Buscar huésped o confirmación")}
            />
          </label>
          <select
            aria-label={t("Filtrar estado")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("Todos los estados")}</option>
            <option value="confirmed">{t("Confirmadas")}</option>
            <option value="checked_in">{t("En casa")}</option>
            <option value="pending">{t("Pendientes")}</option>
            <option value="cancelled">{t("Canceladas")}</option>
            <option value="checked_out">{t("Finalizadas")}</option>
            <option value="draft">{t("Borradores")}</option>
            <option value="no_show">{t("No-show")}</option>
          </select>
          <span className="muted">
            {t("{count} estancias", { count: reservations.length })}
          </span>
        </div>
        <ReservationTable reservations={reservations} onSelect={setSelected} />
      </div>
      {create && <ReservationForm onClose={() => setCreate(false)} />}{" "}
      {selected && (
        <ReservationInspector id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
