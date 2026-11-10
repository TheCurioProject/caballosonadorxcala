import { createHash } from "node:crypto";
import type { ProviderContext } from "@/cala/domain/migration/canonical";
import type {
  DistributionProvider,
  PaymentProvider,
  MigrationProvider,
} from "@/cala/application/ports/providers";
import type { MigrationRecord } from "@/cala/domain/model";
import { addDays } from "@/cala/domain/shared/dates";
import { DomainError } from "@/cala/domain/shared/errors";
const info = {
  id: "development",
  mode: "development" as const,
  configured: true,
};
export class MockPaymentProvider implements PaymentProvider {
  info = info;
  async pay(input: Parameters<PaymentProvider["pay"]>[0]) {
    return {
      externalId: "demo-pay-" + input.idempotencyKey,
      status: input.simulateFailure
        ? ("failed" as const)
        : ("succeeded" as const),
    };
  }
}
export class MockDistributionProvider implements DistributionProvider {
  info = info;
  async pushARI(input: Parameters<DistributionProvider["pushARI"]>[0]) {
    if (input.simulateFailure)
      throw new DomainError(
        "DEMO_PROVIDER_UNAVAILABLE",
        "El proveedor de demostración devolvió un error temporal.",
        503,
      );
    return { acknowledgement: "demo-ari-" + input.idempotencyKey };
  }
}
export class MockMigrationProvider implements MigrationProvider {
  info = info;
  async connect() {
    return { connectionId: "demo-fixture-v1" };
  }
  async discover() {
    return {
      name: "Casa Jacaranda · archivo de demostración",
      categories: ["inventory", "guest", "reservation", "rate"],
    };
  }
  async extract(date: string): Promise<MigrationRecord[]> {
    return [
      {
        externalId: "fixture-room",
        kind: "inventory",
        payload: {
          name: "Suite importada",
          baseRateMinor: 280000,
          maxOccupancy: 2,
        },
        status: "staged",
      },
      {
        externalId: "fixture-guest",
        kind: "guest",
        payload: {
          firstName: "Clara",
          lastName: "Montes",
          email: "clara.montes@example.test",
        },
        status: "staged",
      },
      {
        externalId: "fixture-reservation",
        kind: "reservation",
        payload: {
          guestExternalId: "fixture-guest",
          inventoryExternalId: "fixture-room",
          arrival: addDays(date, 14),
          departure: addDays(date, 17),
          adults: 2,
        },
        status: "staged",
      },
      {
        externalId: "fixture-rate",
        kind: "rate",
        payload: {
          inventoryExternalId: "fixture-room",
          date: addDays(date, 14),
          amountMinor: 280000,
        },
        status: "staged",
      },
    ];
  }
  private envelope<T>(externalId: string, data: T) {
    return {
      externalId,
      data,
      fingerprint: createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex"),
    };
  }
  async *getProperties() {
    yield this.envelope("fixture-property", {
      name: "Casa Jacaranda · archivo de demostración",
      timezone: "America/Mexico_City",
      currency: "MXN",
    });
  }
  async *getInventory() {
    yield this.envelope("fixture-room", {
      name: "Suite importada",
      maxOccupancy: 2,
      baseRateMinor: 280000,
    });
  }
  async *getGuests() {
    yield this.envelope("fixture-guest", {
      firstName: "Clara",
      lastName: "Montes",
      email: "clara.montes@example.test",
    });
  }
  async *getReservations(ctx: ProviderContext) {
    yield this.envelope("fixture-reservation", {
      guestExternalId: "fixture-guest",
      inventoryExternalId: "fixture-room",
      arrival: addDays(ctx.date, 14),
      departure: addDays(ctx.date, 17),
      adults: 2,
    });
  }
  async *getRatePlans() {
    yield this.envelope("fixture-plan", { name: "Tarifa flexible" });
  }
  async *getRates(ctx: ProviderContext) {
    yield this.envelope("fixture-rate", {
      inventoryExternalId: "fixture-room",
      date: addDays(ctx.date, 14),
      amountMinor: 280000,
    });
  }
  async *getRestrictions(ctx: ProviderContext) {
    yield this.envelope("fixture-restriction", {
      inventoryExternalId: "fixture-room",
      date: addDays(ctx.date, 14),
      minStay: 1,
      maxStay: 730,
      closed: false,
      cta: false,
      ctd: false,
    });
  }
  async *getAmenities() {
    yield this.envelope("fixture-amenity", { name: "Wi-Fi" });
  }
  async validate() {
    return { valid: true, issues: [] };
  }
  async disconnect() {}
}
