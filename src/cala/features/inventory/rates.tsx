"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import {
  SectionTitle,
  Icon,
  Modal,
  Form,
  Empty,
} from "@/cala/components/ui/primitives";
import { money, shortDate } from "@/cala/lib/format";
import { addDays, nights } from "@/cala/domain/shared/dates";
import { parseMoney, moneyInput } from "@/cala/domain/shared/money";
import { useI18n } from "@/cala/lib/i18n";
import type { InventoryType, RateDay } from "@/cala/domain/model";

/**
 * Tarifas y restricciones · month grid (Smoobu-style).
 * Every day of the month is a column and every sellable space a row. A tap on
 * a price edits that night in place; a tap on the space's name opens its
 * rules (date-range restrictions) and settings (base rate, capacity, name).
 */
type Cell = {
  amountMinor: number;
  minStay: number;
  maxStay: number;
  closed: boolean;
  cta: boolean;
  ctd: boolean;
  version: number;
  custom: boolean;
};

const monthStart = (date: string) => date.slice(0, 8) + "01";
function shiftMonth(start: string, delta: number) {
  const [y, m] = start.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}
function daysOfMonth(start: string) {
  const [y, m] = start.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}
const compact = (minor: number) =>
  new Intl.NumberFormat(
    typeof document !== "undefined" && document.documentElement.lang === "en-US"
      ? "en-US"
      : "es-MX",
    { maximumFractionDigits: minor % 100 ? 2 : 0 },
  ).format(minor / 100);

export function Rates() {
  const { data, command, can, notify } = useWorkspace();
  const { t: tr, locale } = useI18n();
  const property = data.properties.find((p) => p.id === data.currentPropertyId);
  const currency = property?.currency ?? "MXN";
  const types = data.inventoryTypes.filter(
    (t) => t.propertyId === data.currentPropertyId,
  );
  const plans = data.ratePlans.filter(
    (p) => p.propertyId === data.currentPropertyId,
  );
  const [plan, setPlan] = useState(plans[0]?.id ?? "");
  const [month, setMonth] = useState(monthStart(data.today));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [optimistic, setOptimistic] = useState<Record<string, number>>({});
  const [rulesFor, setRulesFor] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const days = useMemo(() => daysOfMonth(month), [month]);
  const editable = can("rates.write");

  const index = useMemo(() => {
    const map = new Map<string, RateDay>();
    for (const d of data.rateDays)
      if (d.ratePlanId === plan) map.set(d.inventoryTypeId + "|" + d.date, d);
    return map;
  }, [data.rateDays, plan]);
  const cell = (type: InventoryType, date: string): Cell => {
    const d = index.get(type.id + "|" + date);
    const key = type.id + "|" + date;
    return {
      amountMinor:
        optimistic[key] ??
        (d && d.amountMinor > 0 ? d.amountMinor : type.baseRateMinor),
      minStay: d?.minStay ?? 1,
      maxStay: d?.maxStay ?? 730,
      closed: d?.closed ?? false,
      cta: d?.cta ?? false,
      ctd: d?.ctd ?? false,
      version: d?.version ?? 0,
      custom: Boolean(d && d.amountMinor > 0),
    };
  };

  // Land on today (or the first day) whenever the month changes.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `[data-date="${month === monthStart(data.today) ? data.today : month}"]`,
    );
    const name = el.querySelector<HTMLElement>(".rates-name");
    if (target)
      el.scrollLeft = Math.max(
        0,
        target.offsetLeft - (name?.offsetWidth ?? 0) - 8,
      );
  }, [month, data.today]);

  async function saveNight(type: InventoryType, date: string, value: string) {
    const key = type.id + "|" + date;
    const current = cell(type, date);
    let amountMinor: number;
    try {
      amountMinor = parseMoney(
        value.replace(/[$\s]/g, "").replace(/,(?=\d{3}\b)/g, ""),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : tr("Importe no válido"), "error");
      return;
    }
    if (amountMinor === current.amountMinor) return;
    setOptimistic((o) => ({ ...o, [key]: amountMinor }));
    try {
      await command({
        type: "rates.bulk",
        ratePlanId: plan,
        inventoryTypeId: type.id,
        arrival: date,
        departure: addDays(date, 1),
        amountMinor,
        minStay: current.minStay,
        maxStay: current.maxStay,
        closed: current.closed,
        cta: current.cta,
        ctd: current.ctd,
        expectedVersions: { [date]: current.version },
      });
    } catch {
      /* command() already explained the failure */
    } finally {
      setOptimistic((o) => {
        const next = { ...o };
        delete next[key];
        return next;
      });
    }
  }

  function begin(type: InventoryType, date: string) {
    if (!editable || date < data.today || !plan) return;
    setEditing(type.id + "|" + date);
    setDraft(moneyInput(cell(type, date).amountMinor).replace(/\.00$/, ""));
  }

  const monthLabel = new Intl.DateTimeFormat(
    locale === "en" ? "en-US" : "es-MX",
    { month: "long", year: "numeric", timeZone: "UTC" },
  )
    .format(new Date(month + "T12:00:00Z"))
    .replace(/^./, (c) => c.toUpperCase());
  const weekday = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", {
    weekday: "short",
    timeZone: "UTC",
  });
  const rulesType = types.find((t) => t.id === rulesFor);

  return (
    <>
      <SectionTitle
        eyebrow={tr("PRECIO CORRECTO, CADA NOCHE")}
        title={tr("Tarifas y restricciones")}
        description={tr(
          "Pulsa un precio para cambiar esa noche. Pulsa el nombre de un alojamiento para sus reglas y ajustes.",
        )}
      >
        {editable && (
          <button className="button secondary" onClick={() => setNewPlan(true)}>
            <Icon name="plus" />
            {tr("Nuevo plan")}
          </button>
        )}
      </SectionTitle>
      <div className="panel rates-panel">
        <div className="rates-toolbar">
          <div className="rates-month" role="group" aria-label={tr("Mes")}>
            <button
              className="icon-button"
              aria-label={tr("Mes anterior")}
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
            >
              <Icon name="chevron-left" />
            </button>
            <strong aria-live="polite">{monthLabel}</strong>
            <button
              className="icon-button"
              aria-label={tr("Mes siguiente")}
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
            >
              <Icon name="chevron-right" />
            </button>
            {month !== monthStart(data.today) && (
              <button
                className="button secondary rates-today"
                onClick={() => setMonth(monthStart(data.today))}
              >
                {tr("Hoy")}
              </button>
            )}
          </div>
          {plans.length > 1 && (
            <label className="rates-plan">
              <span className="sr-only">{tr("Plan de tarifas")}</span>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="rates-legend" aria-label={tr("Leyenda")}>
            <li>
              <i className="flag closed" /> {tr("Cerrado")}
            </li>
            <li>
              <i className="flag cta" /> {tr("Sin llegadas")}
            </li>
            <li>
              <i className="flag ctd" /> {tr("Sin salidas")}
            </li>
            <li>
              <b className="flag-min">2n</b> {tr("Estancia mínima")}
            </li>
          </ul>
        </div>
        {!types.length || !plan ? (
          <Empty
            asset="empty-reservations"
            title={tr("Aún no hay tarifas que mostrar")}
            description={tr(
              "Crea un alojamiento en Inventario y un plan de tarifas para empezar.",
            )}
          />
        ) : (
          <div className="rates-scroller" ref={scroller}>
            <table className="rates-grid">
              <caption className="sr-only">
                {tr("Precio por noche en {currency}", { currency })}
              </caption>
              <thead>
                <tr>
                  <th className="rates-name rates-corner" scope="col">
                    <span>{tr("Alojamiento")}</span>
                    <small>{currency}</small>
                  </th>
                  {days.map((date) => {
                    const dow = new Date(date + "T12:00:00Z").getUTCDay();
                    return (
                      <th
                        key={date}
                        scope="col"
                        data-date={date}
                        className={[
                          "rates-day",
                          dow === 0 || dow === 6 ? "weekend" : "",
                          date === data.today ? "today" : "",
                          date < data.today ? "past" : "",
                        ].join(" ")}
                      >
                        <small>
                          {weekday
                            .format(new Date(date + "T12:00:00Z"))
                            .replace(".", "")}
                        </small>
                        <b>{Number(date.slice(8))}</b>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {types.map((type) => {
                  const unitCount = data.units.filter(
                    (u) => u.inventoryTypeId === type.id && u.active,
                  ).length;
                  return (
                    <tr key={type.id}>
                      <th scope="row" className="rates-name">
                        <button
                          type="button"
                          onClick={() => setRulesFor(type.id)}
                          aria-label={tr("Reglas y ajustes de {name}", {
                            name: type.name,
                          })}
                        >
                          <span>
                            <strong>{type.name}</strong>
                            <small>
                              {tr("Base {amount}", {
                                amount: money(type.baseRateMinor, currency),
                              })}
                              {unitCount > 1 ? ` · ${unitCount} u.` : ""}
                            </small>
                          </span>
                          <Icon name="settings" size={15} />
                        </button>
                      </th>
                      {days.map((date) => {
                        const c = cell(type, date);
                        const key = type.id + "|" + date;
                        const dow = new Date(date + "T12:00:00Z").getUTCDay();
                        const past = date < data.today;
                        return (
                          <td
                            key={date}
                            className={[
                              "rates-cell",
                              dow === 0 || dow === 6 ? "weekend" : "",
                              date === data.today ? "today" : "",
                              past ? "past" : "",
                              c.closed ? "is-closed" : "",
                              c.custom ? "is-custom" : "",
                              key in optimistic ? "is-saving" : "",
                            ].join(" ")}
                          >
                            {editing === key ? (
                              <input
                                className="rates-input"
                                autoFocus
                                inputMode="decimal"
                                aria-label={tr("Precio de {name} el {date}", {
                                  name: type.name,
                                  date: shortDate(date),
                                })}
                                value={draft}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => {
                                  setEditing(null);
                                  void saveNight(type, date, draft);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") {
                                    setDraft(
                                      moneyInput(c.amountMinor).replace(
                                        /\.00$/,
                                        "",
                                      ),
                                    );
                                    setEditing(null);
                                  }
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    void saveNight(type, date, draft);
                                    const next = addDays(
                                      date,
                                      e.shiftKey ? -1 : 1,
                                    );
                                    if (days.includes(next)) begin(type, next);
                                    else setEditing(null);
                                  }
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="rates-price"
                                disabled={past || !editable}
                                onClick={() => begin(type, date)}
                                title={
                                  past
                                    ? undefined
                                    : tr("Cambiar precio del {date}", {
                                        date: shortDate(date),
                                      })
                                }
                              >
                                {compact(c.amountMinor)}
                              </button>
                            )}
                            {(c.minStay > 1 || c.closed || c.cta || c.ctd) && (
                              <span className="rates-flags" aria-hidden="true">
                                {c.closed && <i className="flag closed" />}
                                {c.cta && <i className="flag cta" />}
                                {c.ctd && <i className="flag ctd" />}
                                {c.minStay > 1 && (
                                  <b className="flag-min">{c.minStay}n</b>
                                )}
                              </span>
                            )}
                            {(c.closed || c.cta || c.ctd || c.minStay > 1) && (
                              <span className="sr-only">
                                {[
                                  c.closed && tr("Cerrado"),
                                  c.cta && tr("Sin llegadas"),
                                  c.ctd && tr("Sin salidas"),
                                  c.minStay > 1 &&
                                    tr("mínimo {n} noches", { n: c.minStay }),
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="rates-hint">
          <Icon name="info" size={14} />
          {tr(
            "Enter guarda · Esc cancela · Tab pasa al día siguiente. Los días pasados no se editan.",
          )}
        </p>
      </div>
      {rulesType && (
        <RulesDialog
          type={rulesType}
          plan={plan}
          currency={currency}
          cell={cell}
          onClose={() => setRulesFor(null)}
        />
      )}
      {newPlan && (
        <Modal
          title={tr("Nuevo plan de tarifas")}
          onClose={() => setNewPlan(false)}
        >
          <Form
            fields={[
              {
                name: "name",
                label: tr("Nombre"),
                value: tr("Tarifa no reembolsable"),
              },
            ]}
            onSubmit={async (v) => {
              const r = await command({ type: "ratePlan.create", ...v });
              setPlan(r.id);
              setNewPlan(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function RulesDialog({
  type,
  plan,
  currency,
  cell,
  onClose,
}: {
  type: InventoryType;
  plan: string;
  currency: string;
  cell: (type: InventoryType, date: string) => Cell;
  onClose: () => void;
}) {
  const { data, command, can } = useWorkspace();
  const { t: tr } = useI18n();
  const [tab, setTab] = useState<"rules" | "settings">("rules");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState(data.today);
  const [to, setTo] = useState(addDays(data.today, 6));
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState(1);
  const [maxStay, setMaxStay] = useState(730);
  const [closed, setClosed] = useState(false);
  const [cta, setCta] = useState(false);
  const [ctd, setCtd] = useState(false);
  const range = to >= from ? nights(from, addDays(to, 1)) : [];
  const upcoming = useMemo(() => {
    // Upcoming nights that carry a restriction, collapsed into runs.
    const out: { from: string; to: string; label: string }[] = [];
    for (let i = 0; i < 120; i++) {
      const date = addDays(data.today, i);
      const c = cell(type, date);
      const label = [
        c.closed && tr("Cerrado"),
        c.cta && tr("Sin llegadas"),
        c.ctd && tr("Sin salidas"),
        c.minStay > 1 && tr("mín. {n} noches", { n: c.minStay }),
      ]
        .filter(Boolean)
        .join(" · ");
      if (!label) continue;
      const last = out[out.length - 1];
      if (last && last.label === label && addDays(last.to, 1) === date)
        last.to = date;
      else out.push({ from: date, to: date, label });
    }
    return out.slice(0, 8);
  }, [cell, type, data.today, tr]);

  async function applyRules(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!range.length) {
      setError(tr("La fecha final debe ser igual o posterior a la inicial."));
      return;
    }
    if (maxStay < minStay) {
      setError(tr("El máximo debe ser mayor o igual al mínimo."));
      return;
    }
    let fixed: number | null = null;
    if (price.trim()) {
      try {
        fixed = parseMoney(price.replace(/[$\s]/g, ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : tr("Importe no válido"));
        return;
      }
    }
    // rates.bulk writes one amount per call: keep each night's own price by
    // sending one call per run of equal prices when no new price is given.
    const runs: { start: string; end: string; amount: number }[] = [];
    for (const date of range) {
      const amount = fixed ?? cell(type, date).amountMinor;
      const last = runs[runs.length - 1];
      if (last && last.amount === amount && addDays(last.end, 1) === date)
        last.end = date;
      else runs.push({ start: date, end: date, amount });
    }
    setBusy(true);
    try {
      for (const run of runs) {
        const runNights = nights(run.start, addDays(run.end, 1));
        await command({
          type: "rates.bulk",
          ratePlanId: plan,
          inventoryTypeId: type.id,
          arrival: run.start,
          departure: addDays(run.end, 1),
          amountMinor: run.amount,
          minStay,
          maxStay,
          closed,
          cta,
          ctd,
          expectedVersions: Object.fromEntries(
            runNights.map((d) => [d, cell(type, d).version]),
          ),
        });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("No se pudo guardar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={type.name} onClose={onClose} wide>
      <div className="tabs rates-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "rules"}
          className={tab === "rules" ? "active" : ""}
          onClick={() => setTab("rules")}
        >
          {tr("Reglas por fechas")}
        </button>
        <button
          role="tab"
          aria-selected={tab === "settings"}
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          {tr("Ajustes del alojamiento")}
        </button>
      </div>
      {tab === "rules" ? (
        <>
          {upcoming.length > 0 && (
            <div className="rates-upcoming">
              <span className="eyebrow">{tr("RESTRICCIONES PRÓXIMAS")}</span>
              <ul>
                {upcoming.map((r) => (
                  <li key={r.from}>
                    <strong>
                      {r.from === r.to
                        ? shortDate(r.from)
                        : `${shortDate(r.from)} – ${shortDate(r.to)}`}
                    </strong>
                    <span>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={applyRules}>
            <div className="form-grid">
              <label className="field">
                <span>{tr("Desde")}</span>
                <input
                  type="date"
                  value={from}
                  min={data.today}
                  required
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{tr("Hasta (incluido)")}</span>
                <input
                  type="date"
                  value={to}
                  min={from}
                  required
                  onChange={(e) => e.target.value && setTo(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{tr("Precio por noche ({currency})", { currency })}</span>
                <input
                  inputMode="decimal"
                  value={price}
                  placeholder={tr("Mantener precios actuales")}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <small>
                  {tr("Déjalo vacío para cambiar solo las reglas.")}
                </small>
              </label>
              <label className="field">
                <span>{tr("Noches")}</span>
                <input readOnly value={range.length} tabIndex={-1} />
              </label>
              <label className="field">
                <span>{tr("Mínimo de noches")}</span>
                <input
                  type="number"
                  min={1}
                  max={730}
                  value={minStay}
                  onChange={(e) => setMinStay(Number(e.target.value) || 1)}
                />
              </label>
              <label className="field">
                <span>{tr("Máximo de noches")}</span>
                <input
                  type="number"
                  min={1}
                  max={730}
                  value={maxStay}
                  onChange={(e) => setMaxStay(Number(e.target.value) || 1)}
                />
              </label>
              <label className="field checkbox">
                <span>{tr("Cerrar venta")}</span>
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) => setClosed(e.target.checked)}
                />
              </label>
              <label className="field checkbox">
                <span>{tr("Cerrar llegadas")}</span>
                <input
                  type="checkbox"
                  checked={cta}
                  onChange={(e) => setCta(e.target.checked)}
                />
              </label>
              <label className="field checkbox">
                <span>{tr("Cerrar salidas")}</span>
                <input
                  type="checkbox"
                  checked={ctd}
                  onChange={(e) => setCtd(e.target.checked)}
                />
              </label>
            </div>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={onClose}
                disabled={busy}
              >
                {tr("Cancelar")}
              </button>
              <button className="button primary" disabled={busy}>
                {busy
                  ? tr("Guardando…")
                  : tr("Aplicar a {count} noches", { count: range.length })}
              </button>
            </div>
          </form>
        </>
      ) : can("inventory.write") ? (
        <Form
          key={type.id + type.baseRateMinor + type.maxOccupancy + type.name}
          fields={[
            { name: "name", label: tr("Nombre"), value: type.name },
            {
              name: "baseRateMinor",
              label: tr("Tarifa base por noche"),
              type: "money",
              value: type.baseRateMinor,
              help: tr("Se usa en las noches sin precio propio."),
            },
            {
              name: "maxOccupancy",
              label: tr("Huéspedes máximos"),
              type: "number",
              min: 1,
              max: 100,
              value: type.maxOccupancy,
            },
            {
              name: "active",
              label: tr("Disponible para la venta"),
              type: "checkbox",
              value: type.active,
            },
          ]}
          onCancel={onClose}
          onSubmit={async (v) => {
            await command({
              type: "inventory.update",
              id: type.id,
              name: v.name,
              baseRateMinor: v.baseRateMinor,
              maxOccupancy: v.maxOccupancy,
              active: v.active,
            });
            onClose();
          }}
        />
      ) : (
        <p className="muted">
          {tr(
            "Tu rol permite cambiar tarifas, no los ajustes del alojamiento.",
          )}
        </p>
      )}
    </Modal>
  );
}
