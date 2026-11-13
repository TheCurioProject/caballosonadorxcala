"use client";

import { CalaLogo } from "@/cala/components/brand/cala-logo";
import { Icon, Modal } from "@/cala/components/ui/primitives";
import { useWorkspace } from "@/cala/features/workspace/context";
import { money, shortDate } from "@/cala/lib/format";
import { useI18n } from "@/cala/lib/i18n";
import {
  conceptLabel,
  conceptOf,
  methodLabel,
  summarizePayments,
} from "@/cala/domain/reservations/payments";

/** "14.3%" — one decimal only when it isn't a whole number. */
function percentOf(part: number, total: number) {
  if (total <= 0) return "";
  const value = Math.round((part / total) * 1000) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function ReservationInvoice({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const { data } = useWorkspace();
  const { t } = useI18n();
  const reservation = data.reservations.find(
    (item) => item.id === reservationId,
  );
  if (!reservation) return null;
  const property = data.properties.find(
    (item) => item.id === reservation.propertyId,
  );
  const guest = data.guests.find((item) => item.id === reservation.guestId);
  const unit = data.units.find((item) => item.id === reservation.unitId);
  const inventoryType = data.inventoryTypes.find(
    (item) => item.id === reservation.inventoryTypeId,
  );
  const lineItems = data.folioItems.filter(
    (item) => item.reservationId === reservation.id,
  );
  const nights = Math.max(
    1,
    Math.round(
      (Date.parse(reservation.departure) - Date.parse(reservation.arrival)) /
        86_400_000,
    ),
  );
  const total = lineItems.length
    ? lineItems.reduce((sum, item) => sum + item.amountMinor, 0)
    : reservation.totalMinor;
  const payments = data.payments
    .filter((p) => p.reservationId === reservation.id && p.status === "succeeded")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const summary = summarizePayments(payments);
  const stayPayments = payments.filter((p) => {
    const c = conceptOf(p);
    return c === "prepayment" || c === "payment" || c === "refund";
  });
  const balance = total - summary.paidMinor;
  const onlyPrepayment =
    stayPayments.length > 0 &&
    stayPayments.every((p) => conceptOf(p) === "prepayment");
  const paidLabel = onlyPrepayment ? t("Anticipo pagado") : t("Total pagado");
  const methodName = (method?: string, provider?: string) =>
    t(methodLabel[method ?? ""] ?? methodLabel[provider ?? ""] ?? "Otro");
  const fmt = (n: number) => money(n, reservation.currency);

  return (
    <Modal title={t("Invoice de reserva")} onClose={onClose} wide>
      <article className="invoice-sheet" aria-label={t("Invoice de reserva")}>
        <header className="invoice-header">
          <div>
            <CalaLogo />
            <span>{t("Emitido por CALA")}</span>
          </div>
          <div className="invoice-heading">
            <span>{t("COMPROBANTE DE RESERVA")}</span>
            <strong>INV-{reservation.confirmationCode}</strong>
            <small>{shortDate(reservation.createdAt.slice(0, 10))}</small>
          </div>
        </header>

        <div className="invoice-parties">
          <section>
            <span>{t("Emitido para")}</span>
            <strong>{property?.name ?? "CALA"}</strong>
            <p>{property?.address}</p>
            <p>{property?.city}</p>
          </section>
          <section>
            <span>{t("Preparado por")}</span>
            <strong>{data.currentUser.name}</strong>
            <p>{data.currentUser.email}</p>
          </section>
          <section>
            <span>{t("Facturado a")}</span>
            <strong>
              {guest
                ? `${guest.firstName} ${guest.lastName}`
                : t("Huésped · acceso restringido")}
            </strong>
            <p>{guest?.email}</p>
            <p>{guest?.phone}</p>
          </section>
        </div>

        <section className="invoice-stay">
          <div>
            <span>{t("Reserva")}</span>
            <strong>{reservation.confirmationCode}</strong>
          </div>
          <div>
            <span>{t("Llegada")}</span>
            <strong>{shortDate(reservation.arrival)}</strong>
          </div>
          <div>
            <span>{t("Salida")}</span>
            <strong>{shortDate(reservation.departure)}</strong>
          </div>
          <div>
            <span>{t("Huésped")}</span>
            <strong>{reservation.adults + reservation.children}</strong>
          </div>
        </section>

        <div className="invoice-table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>{t("Descripción")}</th>
                <th>{t("Cantidad")}</th>
                <th>{t("Precio")}</th>
              </tr>
            </thead>
            <tbody>
              {(lineItems.length
                ? lineItems
                : [
                    {
                      id: reservation.id,
                      description: t("Alojamiento · {nights} noches", {
                        nights,
                      }),
                      amountMinor: reservation.totalMinor,
                    },
                  ]
              ).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.description}</strong>
                    <small>
                      {inventoryType?.name}
                      {unit ? ` · ${unit.name}` : ""}
                    </small>
                  </td>
                  <td>{nights}</td>
                  <td>{money(item.amountMinor, reservation.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{t("Total")}</td>
                <td>{money(total, reservation.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <section className="invoice-payments" aria-label={t("Pagos")}>
          {stayPayments.length > 0 && (
            <div className="invoice-payment-list">
              <span className="invoice-label">{t("Pagos recibidos")}</span>
              <ul>
                {stayPayments.map((p) => {
                  const refund = conceptOf(p) === "refund";
                  return (
                    <li key={p.id}>
                      <div>
                        <strong>{t(conceptLabel[conceptOf(p)])}</strong>
                        <small>
                          {shortDate(p.createdAt.slice(0, 10))} ·{" "}
                          {methodName(p.method, p.provider)}
                        </small>
                      </div>
                      <span>
                        {refund ? "−" : ""}
                        {fmt(p.amountMinor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <dl className="invoice-summary">
            <div>
              <dt>{t("Total de la estancia")}</dt>
              <dd>{fmt(total)}</dd>
            </div>
            {summary.paidMinor > 0 && (
              <div>
                <dt>
                  {paidLabel}{" "}
                  <span className="invoice-percent">
                    ({percentOf(summary.paidMinor, total)})
                  </span>
                </dt>
                <dd>{fmt(summary.paidMinor)}</dd>
              </div>
            )}
            {balance > 0 ? (
              <div className="invoice-balance">
                <dt>
                  {t("Saldo pendiente")}{" "}
                  <span className="invoice-percent">
                    ({percentOf(balance, total)})
                  </span>
                  <small>
                    {t("A liquidar a la llegada · {date}", {
                      date: shortDate(reservation.arrival),
                    })}
                  </small>
                </dt>
                <dd>{fmt(balance)}</dd>
              </div>
            ) : (
              <div className="invoice-balance is-paid">
                <dt>{t("Pagado en su totalidad")}</dt>
                <dd>{fmt(0)}</dd>
              </div>
            )}
            {summary.depositHeldMinor > 0 && (
              <div className="invoice-deposit">
                <dt>
                  {t("Depósito en garantía (reembolsable)")}
                  <small>{t("No forma parte del precio de la estancia.")}</small>
                </dt>
                <dd>{fmt(summary.depositHeldMinor)}</dd>
              </div>
            )}
          </dl>
        </section>

        <footer className="invoice-footer">
          <div>
            <strong>CALA</strong>
            <span>Hospitality, in flow.</span>
          </div>
          <small>{t("No es un comprobante fiscal.")}</small>
        </footer>
      </article>
      <div className="invoice-actions">
        <button className="button secondary" onClick={onClose}>
          {t("Cerrar")}
        </button>
        <button className="button primary" onClick={() => window.print()}>
          <Icon name="download" />
          {t("Imprimir / Guardar PDF")}
        </button>
      </div>
    </Modal>
  );
}
