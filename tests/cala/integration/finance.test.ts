import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";
import { DevelopmentJobScheduler } from "../fixtures/job-scheduler";
import {
  MockMigrationProvider,
  MockDistributionProvider,
} from "../fixtures/providers";
import { parseMoney } from "@/cala/domain/shared/money";
test("payment intent is pending until provider confirms and a failed payment never settles", async () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const worker = new DevelopmentJobScheduler(
    store,
    new MockMigrationProvider(),
    new MockDistributionProvider(),
  );
  const actor = {
    userId: "user-owner",
    stepUpUntil: new Date(Date.now() + 300000).toISOString(),
  };
  const base = { organizationId: "org-estancia", propertyId: "property-hotel" };
  const r = store
    .read()
    .reservations.find((r) => r.propertyId === base.propertyId)!;
  const payment = {
    ...base,
    type: "payment.create",
    reservationId: r.id,
    amountMinor: 10000,
    simulateFailure: false,
  };
  const first = app.execute(actor, payment, "payment-job-1");
  expect(app.execute(actor, payment, "payment-job-1")).toEqual(first);
  expect(store.read().payments.find((p) => p.id === first.id)?.status).toBe(
    "pending",
  );
  async function drain() {
    for (let i = 0; i < 8; i++) {
      store.transaction((s) => {
        for (const j of s.jobs) j.runAfter = "2000-01-01T00:00:00Z";
      });
      await worker.tick();
    }
  }
  await drain();
  expect(store.read().payments.find((p) => p.id === first.id)?.status).toBe(
    "succeeded",
  );
  const failed = app.execute(
    actor,
    { ...payment, simulateFailure: true },
    "payment-failed",
  );
  await drain();
  expect(store.read().payments.find((p) => p.id === failed.id)?.status).toBe(
    "failed",
  );
  store.close();
});
test("decimal money conversion is exact and rejects fractional cents", () => {
  expect(parseMoney("0.29")).toBe(29);
  expect(parseMoney("1234,56")).toBe(123456);
  expect(() => parseMoney("0.001")).toThrow();
  expect(() => parseMoney("1e2")).toThrow();
});
