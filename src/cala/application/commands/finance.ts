import type { Command } from "../schemas";
import type { Context } from "../context";
import { permit, audit, result } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { enqueue } from "./jobs";
export function financeCommand(c: Context, cmd: Command) {
  const s = c.state;
  if (
    cmd.type === "payment.record" ||
    cmd.type === "payment.update" ||
    cmd.type === "payment.delete"
  ) {
    permit(c, cmd.organizationId, "finance.write", cmd.propertyId);
    let id: string, reservationId: string;
    if (cmd.type === "payment.record") {
      const r = s.reservations.find(
        (r) => r.id === cmd.reservationId && r.propertyId === cmd.propertyId,
      );
      invariant(r, "NOT_FOUND", "Reserva no encontrada.", 404);
      id = c.id();
      reservationId = r.id;
      s.payments.push({
        id,
        propertyId: cmd.propertyId,
        reservationId: r.id,
        amountMinor: cmd.amountMinor,
        provider: "manual",
        externalId: id,
        status: cmd.status,
        createdAt: cmd.paidOn + "T12:00:00.000Z",
        concept: cmd.concept,
        method: cmd.method,
        note: cmd.note,
      });
    } else {
      const index = s.payments.findIndex(
        (p) => p.id === cmd.id && p.propertyId === cmd.propertyId,
      );
      invariant(index >= 0, "NOT_FOUND", "Pago no encontrado.", 404);
      const p = s.payments[index];
      invariant(
        p.provider !== "stripe",
        "PAYMENT_PROVIDER_LOCKED",
        "Los pagos cobrados con Stripe no se editan ni se borran desde CALA.",
        409,
      );
      id = p.id;
      reservationId = p.reservationId;
      if (cmd.type === "payment.delete") s.payments.splice(index, 1);
      else
        Object.assign(p, {
          amountMinor: cmd.amountMinor,
          status: cmd.status,
          createdAt: cmd.paidOn + "T12:00:00.000Z",
          concept: cmd.concept,
          method: cmd.method,
          note: cmd.note,
        });
    }
    const message =
      cmd.type === "payment.record"
        ? "Pago registrado"
        : cmd.type === "payment.update"
          ? "Pago actualizado"
          : "Pago eliminado";
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, reservationId, message);
    return result(id, message);
  }
  if (cmd.type === "folio.charge" || cmd.type === "payment.create") {
    permit(c, cmd.organizationId, "finance.write", cmd.propertyId);
    const r = s.reservations.find(
      (r) => r.id === cmd.reservationId && r.propertyId === cmd.propertyId,
    );
    invariant(r, "NOT_FOUND", "Reserva no encontrada.", 404);
    const id = c.id();
    if (cmd.type === "folio.charge") {
      s.folioItems.push({
        id,
        propertyId: cmd.propertyId,
        reservationId: r.id,
        description: cmd.description,
        amountMinor: cmd.amountMinor,
        kind: "charge",
        createdAt: c.now,
      });
    } else {
      s.payments.push({
        id,
        propertyId: cmd.propertyId,
        reservationId: r.id,
        amountMinor: cmd.amountMinor,
        provider: "development",
        externalId: "",
        status: "pending",
        createdAt: c.now,
      });
      enqueue(c, {
        organizationId: cmd.organizationId,
        propertyId: cmd.propertyId,
        type: "payment",
        payload: {
          paymentId: id,
          currency: r.currency,
          simulateFailure: cmd.simulateFailure,
        },
      });
    }
    audit(c, cmd.organizationId, cmd.propertyId, cmd.type, id);
    return result(
      id,
      cmd.type === "folio.charge" ? "Cargo registrado" : "Pago en proceso",
    );
  }
}
