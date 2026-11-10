import { hospitalityCommand } from "./commands/hospitality";
import { icalCommand } from "./commands/ical";
import { createHash } from "node:crypto";
import type { Actor, CommandResult } from "@/cala/domain/model";
import type { PersistenceAdapter } from "./ports/persistence";
import { commandSchema } from "./schemas";
import { context } from "./context";
import { propertyCommand } from "./commands/properties";
import { inventoryCommand } from "./commands/inventory";
import { reservationCommand } from "./commands/reservations";
import { financeCommand } from "./commands/finance";
import { jobCommand } from "./commands/jobs";
import { invariant } from "@/cala/domain/shared/errors";
import { authorizeCommand } from "./authorize-command";
export class ApplicationService {
  constructor(private store: PersistenceAdapter) {}
  execute(actor: Actor, input: unknown, key: string): CommandResult {
    const cmd = commandSchema.parse(input);
    invariant(
      key.length >= 8 && key.length <= 120,
      "IDEMPOTENCY_REQUIRED",
      "Se requiere una clave de idempotencia válida.",
    );
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(cmd))
      .digest("hex");
    const org =
      "organizationId" in cmd ? cmd.organizationId : "create:" + actor.userId;
    return this.store.transaction((s) => {
      authorizeCommand(s, actor, cmd);
      const previous = s.idempotency.find(
        (x) =>
          x.key === key &&
          x.organizationId === org &&
          x.actorId === actor.userId,
      );
      if (previous) {
        invariant(
          previous.fingerprint === fingerprint,
          "IDEMPOTENCY_CONFLICT",
          "Esta clave ya se usó con otros datos.",
          409,
        );
        return previous.result;
      }
      invariant(
        s.users.some((u) => u.id === actor.userId),
        "UNAUTHORIZED",
        "Inicia sesión.",
        401,
      );
      const c = context(s, actor, key);
      const response =
        hospitalityCommand(c, cmd) ??
        icalCommand(c, cmd) ??
        propertyCommand(c, cmd) ??
        inventoryCommand(c, cmd) ??
        reservationCommand(c, cmd) ??
        financeCommand(c, cmd) ??
        jobCommand(c, cmd);
      invariant(response, "UNKNOWN_COMMAND", "Acción no disponible.");
      s.idempotency.push({
        key,
        organizationId: org,
        actorId: actor.userId,
        fingerprint,
        result: response,
        createdAt: c.now,
      });
      return response;
    });
  }
}
