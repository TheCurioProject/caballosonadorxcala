import type { Command } from "../schemas";
import type { Context } from "../context";
import { permit, audit, result } from "../context";
import { invariant } from "@/cala/domain/shared/errors";
import { enqueue } from "./jobs";
export function financeCommand(c: Context, cmd: Command) {
  const s = c.state;
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
