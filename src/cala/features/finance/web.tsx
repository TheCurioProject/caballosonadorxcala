"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";
import { Icon, fitChars } from "@/cala/components/ui/primitives";
import { money, shortDate, dateTime } from "@/cala/lib/format";

type Amount = { amount: number; currency: string };
type Charge = {
  id: string;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  receiptEmail: string | null;
  name: string | null;
};
type Alert = {
  id: string;
  bookingId: number;
  guestName: string;
  start: string;
  end: string;
  createdAt: string;
};
type WebPayments = {
  alerts: Alert[] | null;
  stripe:
    | { configured: false }
    | { configured: true; error: true }
    | {
        configured: true;
        error?: undefined;
        available: Amount[];
        pending: Amount[];
        charges: Charge[];
      };
};

const ENDPOINT = "/api/cala/finance/web/";
const total = (list: Amount[]) =>
  list.length
    ? list.map((b) => money(b.amount, b.currency.toUpperCase())).join(" · ")
    : money(0, "MXN");

/**
 * Finanzas → Pagos web: what used to live in the website screens "Pagos de la
 * web" and "Revisión de pagos". Payments themselves are recorded on each
 * reservation (Folios y pagos); this tab shows the Stripe account and the paid
 * website bookings that need a decision.
 */
export function WebPaymentsPanel({
  onOpenReservation,
}: {
  onOpenReservation: (id: string) => void;
}) {
  const { data, can, notify } = useWorkspace();
  const { t } = useI18n();
  const [state, setState] = useState<WebPayments | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof json.message === "string"
            ? json.message
            : "No se pudo cargar. Inténtalo de nuevo.",
        );
      setState(json as WebPayments);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar. Inténtalo de nuevo.",
      );
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function resolve(id: string) {
    setBusy(id);
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", id }),
      });
      if (!response.ok) throw new Error();
      setState((s) =>
        s ? { ...s, alerts: s.alerts?.filter((a) => a.id !== id) ?? null } : s,
      );
      notify(t("Marcado como resuelto."), "success");
    } catch {
      notify(t("No se pudo completar. Inténtalo de nuevo."), "error");
    } finally {
      setBusy("");
    }
  }

  const reservationFor = (bookingId: number) =>
    data.reservations.find((r) => r.confirmationCode === `WEB-${bookingId}`);
  const s = state?.stripe;

  return (
    <div className="web-payments">
      {error && (
        <div className="notice error" role="alert">
          {t(error)}{" "}
          <button className="button secondary small" onClick={load}>
            {t("Reintentar")}
          </button>
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{t("Pagos web por revisar")}</h2>
            <p className="muted">
              {t(
                "Reservas pagadas en la web que chocaron con otra estancia. Quedan en borrador hasta que acuerdes una solución con el huésped.",
              )}
            </p>
          </div>
        </div>
        {!state ? (
          !error && <p className="muted padded">{t("Cargando…")}</p>
        ) : state.alerts === null ? (
          <p className="muted padded">
            {t("No se pudo consultar la web. Inténtalo más tarde.")}
          </p>
        ) : state.alerts.length ? (
          <ul className="web-alerts">
            {state.alerts.map((a) => {
              const r = reservationFor(a.bookingId);
              return (
                <li key={a.id}>
                  <div className="web-alert-main">
                    <strong>
                      {t("Reserva web")} #{a.bookingId} ·{" "}
                      <span data-no-translate>{a.guestName}</span>
                    </strong>
                    <small className="muted">
                      {shortDate(a.start)} → {shortDate(a.end)} ·{" "}
                      {t("Pago recibido con conflicto de inventario.")}
                    </small>
                  </div>
                  <div className="web-alert-actions">
                    {r ? (
                      <button
                        className="button secondary small"
                        onClick={() => onOpenReservation(r.id)}
                      >
                        {t("Abrir folio")}
                      </button>
                    ) : (
                      <Link
                        className="button secondary small"
                        href="/admin/reservas?status=draft"
                      >
                        {t("Ver borradores")}
                      </Link>
                    )}
                    {can("finance.write") && (
                      <button
                        className="button ghost small"
                        disabled={busy === a.id}
                        onClick={() => resolve(a.id)}
                      >
                        <Icon name="check" size={16} />
                        {t("Marcar resuelto")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted padded">
            {t("No hay pagos pendientes de revisión.")}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Stripe</h2>
            <p className="muted">
              {t(
                "Saldo de la cuenta y últimos cobros con tarjeta de la web (alojamiento, tours y retiros).",
              )}
            </p>
          </div>
          <a
            className="button secondary small"
            href="https://dashboard.stripe.com/payments"
            target="_blank"
            rel="noreferrer"
          >
            {t("Abrir Stripe")}
          </a>
        </div>
        {!s ? (
          !error && <p className="muted padded">{t("Cargando…")}</p>
        ) : !s.configured ? (
          <p className="muted padded">
            {t("Stripe no está configurado en este servidor.")}
          </p>
        ) : s.error ? (
          <p className="muted padded">
            {t("No se pudo conectar con Stripe. Revisa la clave de API.")}
          </p>
        ) : (
          <>
            <div className="stats web-balance">
              <div className="stat">
                <span className="muted">{t("Disponible")}</span>
                <strong style={fitChars(total(s.available))}>
                  {total(s.available)}
                </strong>
                <small>{t("Listo para transferir a tu banco")}</small>
              </div>
              <div className="stat">
                <span className="muted">{t("En tránsito")}</span>
                <strong style={fitChars(total(s.pending))}>
                  {total(s.pending)}
                </strong>
                <small>{t("Cobros que Stripe aún no libera")}</small>
              </div>
            </div>
            {s.charges.length ? (
              <ul className="web-charges">
                {s.charges.map((c) => {
                  const refunded = c.amountRefunded > 0;
                  const label =
                    c.status === "succeeded"
                      ? refunded
                        ? t("Reembolsado")
                        : t("Pagado")
                      : c.status === "pending"
                        ? t("Pendiente")
                        : t("Fallido");
                  return (
                    <li key={c.id}>
                      <div className="web-charge-main">
                        <strong data-no-translate>
                          {c.description || c.name || c.receiptEmail || t("Cobro web")}
                        </strong>
                        <small className="muted">
                          {dateTime(new Date(c.created * 1000).toISOString())}
                          {c.receiptEmail && c.description ? (
                            <span data-no-translate> · {c.receiptEmail}</span>
                          ) : null}
                        </small>
                      </div>
                      <span
                        className={
                          "payment-chip " +
                          (c.status === "succeeded" && !refunded
                            ? "is-paid"
                            : c.status === "failed"
                              ? "is-failed"
                              : "is-due")
                        }
                      >
                        {label}
                      </span>
                      <strong className="mono web-charge-amount">
                        {money(c.amount, c.currency.toUpperCase())}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted padded">{t("Sin cobros recientes.")}</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
