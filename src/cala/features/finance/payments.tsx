"use client";
import { useState } from "react";
import { useWorkspace } from "@/cala/features/workspace/context";
import { useI18n } from "@/cala/lib/i18n";
import { Form, Icon, fitChars } from "@/cala/components/ui/primitives";
import { money, shortDate } from "@/cala/lib/format";
import type { Payment, PaymentConcept, Reservation } from "@/cala/domain/model";
import {
  PAYMENT_CONCEPTS,
  PAYMENT_METHODS,
  conceptLabel,
  conceptOf,
  methodLabel,
  summarizePayments,
} from "@/cala/domain/reservations/payments";

/** Total charged for a stay (folio), falling back to the agreed price. */
export function reservationTotal(
  data: { folioItems: { reservationId: string; amountMinor: number }[] },
  r: Pick<Reservation, "id" | "totalMinor">,
) {
  const items = data.folioItems.filter((i) => i.reservationId === r.id);
  return items.length
    ? items.reduce((a, b) => a + b.amountMinor, 0)
    : r.totalMinor;
}

type Draft = {
  payment?: Payment;
  concept: PaymentConcept;
  amountMinor: number;
};

/**
 * Payments of one reservation: prepayment, balance, refunds and security deposit,
 * like Smoobu's "Payment details" + prepayment box, as a full ledger.
 */
export function ReservationPayments({
  reservation: r,
  compact = false,
}: {
  reservation: Reservation;
  compact?: boolean;
}) {
  const { data, can, command } = useWorkspace();
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const write = can("finance.write");
  const payments = data.payments
    .filter((p) => p.reservationId === r.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = reservationTotal(data, r);
  const s = summarizePayments(payments);
  const balance = total - s.paidMinor;
  const today = data.today;
  const open = (d: Draft) => {
    setError("");
    setDeleting(null);
    setDraft(d);
  };
  const tiles: [string, number, string?][] = [
    ["Total de la estancia", total],
    ["Pagado", s.paidMinor, s.paidMinor > 0 ? "text-success" : ""],
    ["Saldo pendiente", balance, balance > 0 ? "text-warning" : ""],
  ];
  if (s.depositHeldMinor > 0)
    tiles.push(["Depósito en garantía retenido", s.depositHeldMinor]);
  return (
    <section className="payments-panel" aria-label={t("Pagos")}>
      <div className="payments-head">
        <h3 className="subheading">{t("Pagos")}</h3>
        {s.prepaymentMinor > 0 && (
          <span
            className={
              "payment-chip " + (s.prepaymentPaid ? "is-paid" : "is-due")
            }
          >
            {t("Anticipo")} {money(s.prepaymentMinor, r.currency)}{" "}
            {s.prepaymentPaid ? (
              <Icon name="check" size={14} />
            ) : (
              t("pendiente")
            )}
          </span>
        )}
      </div>
      <div className={"payment-tiles" + (compact ? " compact" : "")}>
        {tiles.map(([label, value, tone]) => (
          <div className="payment-tile" key={label}>
            <small>{t(label)}</small>
            <strong
              className={"mono " + (tone ?? "")}
              style={fitChars(money(value, r.currency))}
            >
              {money(value, r.currency)}
            </strong>
          </div>
        ))}
      </div>
      {s.scheduledMinor !== 0 && (
        <p className="muted payments-note">
          {t("Por recibir")}: {money(s.scheduledMinor, r.currency)}
        </p>
      )}
      {payments.length ? (
        <ul className="payment-list">
          {payments.map((p) => {
            const concept = conceptOf(p);
            const negative = concept === "refund" || concept === "deposit_return";
            const locked = p.provider === "stripe";
            return (
              <li key={p.id} className="payment-row">
                <span className={"payment-icon concept-" + concept}>
                  <Icon
                    name={
                      negative ? "refund" : concept === "deposit" ? "lock" : "cash"
                    }
                    size={16}
                  />
                </span>
                <div className="payment-main">
                  <strong>{t(conceptLabel[concept])}</strong>
                  <small>
                    {shortDate(p.createdAt.slice(0, 10))} ·{" "}
                    {t(methodLabel[p.method ?? ""] ?? methodLabel[p.provider] ?? p.provider)}
                    {p.status === "pending" ? " · " + t("Pendiente") : ""}
                    {p.status === "failed" ? " · " + t("Fallido") : ""}
                  </small>
                  {p.note && (
                    <small className="payment-note" data-no-translate>
                      {p.note}
                    </small>
                  )}
                </div>
                <strong
                  className={
                    "mono payment-amount" +
                    (p.status !== "succeeded" ? " muted" : "") +
                    (negative ? " text-danger" : "")
                  }
                >
                  {negative ? "−" : ""}
                  {money(p.amountMinor, r.currency)}
                </strong>
                {write && !locked && (
                  <span className="payment-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Editar pago")}
                      title={t("Editar pago")}
                      onClick={() =>
                        open({ payment: p, concept, amountMinor: p.amountMinor })
                      }
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Eliminar pago")}
                      title={t("Eliminar pago")}
                      onClick={() => {
                        setDraft(null);
                        setDeleting(p.id);
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                )}
                {deleting === p.id && (
                  <div className="confirmation payment-confirm">
                    <p>{t("¿Eliminar este pago? El saldo se recalculará.")}</p>
                    <div className="row">
                      <button
                        className="button danger"
                        onClick={async () => {
                          setError("");
                          try {
                            await command({
                              type: "payment.delete",
                              propertyId: r.propertyId,
                              id: p.id,
                            });
                            setDeleting(null);
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : t("No se pudo guardar."),
                            );
                          }
                        }}
                      >
                        {t("Eliminar")}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => setDeleting(null)}
                      >
                        {t("Volver")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted payments-note">
          {t("Sin pagos registrados. Registra el anticipo o el pago en cuanto lo recibas.")}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {write && !draft && (
        <div className="payment-quick">
          <button
            className="button secondary"
            onClick={() =>
              open({
                concept: s.paidMinor > 0 ? "payment" : "prepayment",
                amountMinor: Math.max(balance, 0),
              })
            }
          >
            <Icon name="plus" />
            {t("Registrar pago")}
          </button>
          {balance > 0 && (
            <button
              className="button secondary"
              onClick={() => open({ concept: "payment", amountMinor: balance })}
            >
              <Icon name="check" />
              {t("Liquidar saldo")} · {money(balance, r.currency)}
            </button>
          )}
          <button
            className="button ghost"
            onClick={() => open({ concept: "deposit", amountMinor: 0 })}
          >
            <Icon name="lock" />
            {t("Depósito en garantía")}
          </button>
        </div>
      )}
      {draft && (
        <div className="payment-form">
          <h4>{draft.payment ? t("Editar pago") : t("Registrar pago")}</h4>
          <Form
            key={draft.payment?.id ?? draft.concept + draft.amountMinor}
            fields={[
              {
                name: "concept",
                label: "Tipo de pago",
                type: "select",
                value: draft.concept,
                options: PAYMENT_CONCEPTS.map((c) => ({
                  value: c,
                  label: t(conceptLabel[c]),
                })),
              },
              {
                name: "amountMinor",
                label: `${t("Importe")} (${r.currency})`,
                type: "money",
                value: draft.amountMinor,
              },
              {
                name: "method",
                label: "Método",
                type: "select",
                value:
                  draft.payment?.method &&
                  (PAYMENT_METHODS as readonly string[]).includes(draft.payment.method)
                    ? draft.payment.method
                    : "transfer",
                options: PAYMENT_METHODS.map((m) => ({
                  value: m,
                  label: t(methodLabel[m]),
                })),
              },
              {
                name: "paidOn",
                label: "Fecha",
                type: "date",
                value: draft.payment?.createdAt.slice(0, 10) ?? today,
              },
              {
                name: "status",
                label: "Estado",
                type: "select",
                value: draft.payment?.status === "pending" ? "pending" : "succeeded",
                options: [
                  { value: "succeeded", label: t("Pagado") },
                  { value: "pending", label: t("Pendiente de cobro") },
                ],
              },
              {
                name: "note",
                label: "Nota",
                type: "textarea",
                required: false,
                maxLength: 500,
                value: draft.payment?.note ?? "",
                help: "Referencia bancaria, folio del recibo o quién lo cobró.",
              },
            ]}
            submit={draft.payment ? t("Guardar cambios") : t("Registrar pago")}
            onCancel={() => setDraft(null)}
            onSubmit={async (v) => {
              if (Number(v.amountMinor) <= 0)
                throw new Error(t("El importe debe ser mayor que cero."));
              await command({
                type: draft.payment ? "payment.update" : "payment.record",
                propertyId: r.propertyId,
                ...(draft.payment
                  ? { id: draft.payment.id }
                  : { reservationId: r.id }),
                concept: v.concept,
                method: v.method,
                amountMinor: v.amountMinor,
                status: v.status,
                paidOn: v.paidOn,
                note: String(v.note ?? ""),
              });
              setDraft(null);
            }}
          />
        </div>
      )}
    </section>
  );
}
