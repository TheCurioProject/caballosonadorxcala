"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicCalendar } from "@/cala/application/public-calendar";
import {
  monthGrid,
  monthStart,
  shiftMonth,
} from "@/cala/domain/calendar/layout";

/** Display only: free nights never bypass the booking inventory transaction. */
export function PublicAvailability({
  calendar,
  language,
  fetchedAt,
}: {
  calendar: PublicCalendar;
  language: "es" | "en";
  fetchedAt: string;
}) {
  const [month, setMonth] = useState(monthStart(calendar.today));
  const router = useRouter(),
    en = language === "en";
  const free = en ? "Available" : "Libre",
    busy = en ? "Unavailable" : "No disponible",
    unknown = en ? "Outside coverage" : "Fuera de cobertura";
  const title = new Intl.DateTimeFormat(en ? "en-GB" : "es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "T12:00:00Z"));
  const firstMonth = monthStart(calendar.coverageStart),
    lastMonth = monthStart(calendar.coverageEnd);
  return (
    <main className="public-availability" lang={en ? "en" : "es"}>
      <p className="eyebrow">CALA</p>
      <h1>{en ? "Availability" : "Disponibilidad"}</h1>
      <p className="muted">
        {en
          ? "Confirm availability with the property when booking."
          : "Confirma disponibilidad con el alojamiento al reservar."}
      </p>
      <section
        className="panel calendar-month-card"
        aria-label={
          en ? "Availability calendar" : "Calendario de disponibilidad"
        }
      >
        <div className="public-calendar-navigation">
          <button
            className="button secondary"
            disabled={month <= firstMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label={en ? "Previous month" : "Mes anterior"}
          >
            ←
          </button>
          <h2 aria-live="polite">{title}</h2>
          <button
            className="button secondary"
            disabled={month >= lastMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label={en ? "Next month" : "Mes siguiente"}
          >
            →
          </button>
        </div>
        <div className="public-calendar-days">
          {(en
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
          ).map((d) => (
            <span className="public-weekday" key={d}>
              {d}
            </span>
          ))}
          {monthGrid(month).map((day) => {
            const covered =
              day >= calendar.coverageStart && day < calendar.coverageEnd;
            const held = calendar.events.some(
              (e) => !e.cancelled && e.arrival <= day && day < e.departure,
            );
            const state = !covered ? "unknown" : held ? "busy" : "free";
            return (
              <div
                key={day}
                data-date={day}
                data-availability={state}
                role="group"
                className={`public-calendar-day ${state} ${day.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""}`}
                aria-label={`${day}: ${!covered ? unknown : held ? busy : free}`}
              >
                <strong>{Number(day.slice(-2))}</strong>
                <span aria-hidden="true">
                  {!covered ? "?" : held ? "—" : "·"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="public-calendar-legend">
          <span>· {free}</span>
          <span>— {busy}</span>
          <span>? {unknown}</span>
        </p>
      </section>
      <p className="muted public-calendar-timestamp">
        {en ? "Last checked" : "Última consulta"}:{" "}
        <time dateTime={fetchedAt}>
          {new Intl.DateTimeFormat(en ? "en-GB" : "es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          }).format(new Date(fetchedAt))}{" "}
          UTC
        </time>
      </p>
      <button className="button secondary" onClick={() => router.refresh()}>
        {en ? "Refresh availability" : "Actualizar disponibilidad"}
      </button>
    </main>
  );
}
