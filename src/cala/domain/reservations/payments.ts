import type { Payment, PaymentConcept } from "../model";

export const PAYMENT_CONCEPTS: PaymentConcept[] = [
  "prepayment",
  "payment",
  "refund",
  "deposit",
  "deposit_return",
];
export const PAYMENT_METHODS = [
  "cash",
  "transfer",
  "card",
  "stripe",
  "paypal",
  "ota",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const conceptLabel: Record<PaymentConcept, string> = {
  prepayment: "Anticipo",
  payment: "Pago",
  refund: "Reembolso",
  deposit: "Depósito en garantía",
  deposit_return: "Devolución de depósito",
};
export const methodLabel: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  stripe: "Stripe",
  paypal: "PayPal",
  ota: "Cobrado por la OTA",
  other: "Otro",
  imported_unverified: "Importado",
  tokenized: "Tarjeta",
};

export function conceptOf(p: Pick<Payment, "concept">): PaymentConcept {
  return p.concept ?? "payment";
}
/** Sign of a payment against the stay balance (deposits are tracked apart). */
export function balanceSign(concept: PaymentConcept) {
  return concept === "refund"
    ? -1
    : concept === "prepayment" || concept === "payment"
      ? 1
      : 0;
}

export interface PaymentSummary {
  /** Net money received for the stay: prepayments + payments − refunds. */
  paidMinor: number;
  /** Expected but not yet received (status pending), net. */
  scheduledMinor: number;
  prepaymentMinor: number;
  prepaymentPaid: boolean;
  refundedMinor: number;
  /** Security deposit currently held (received − returned). */
  depositHeldMinor: number;
}

export function summarizePayments(payments: Payment[]): PaymentSummary {
  const s: PaymentSummary = {
    paidMinor: 0,
    scheduledMinor: 0,
    prepaymentMinor: 0,
    prepaymentPaid: false,
    refundedMinor: 0,
    depositHeldMinor: 0,
  };
  let prepaymentPending = false;
  for (const p of payments) {
    if (p.status === "failed") continue;
    const concept = conceptOf(p);
    const paid = p.status === "succeeded";
    if (concept === "prepayment") {
      s.prepaymentMinor += p.amountMinor;
      if (!paid) prepaymentPending = true;
    }
    if (concept === "deposit" || concept === "deposit_return") {
      if (paid)
        s.depositHeldMinor +=
          concept === "deposit" ? p.amountMinor : -p.amountMinor;
      continue;
    }
    if (concept === "refund" && paid) s.refundedMinor += p.amountMinor;
    const signed = balanceSign(concept) * p.amountMinor;
    if (paid) s.paidMinor += signed;
    else s.scheduledMinor += signed;
  }
  s.prepaymentPaid = s.prepaymentMinor > 0 && !prepaymentPending;
  return s;
}

/** Net paid of a list of payments (any reservations) — what the guest has paid for stays. */
export function netPaid(payments: Payment[]) {
  return summarizePayments(payments).paidMinor;
}
