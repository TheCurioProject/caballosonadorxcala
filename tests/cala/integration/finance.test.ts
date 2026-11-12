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

test("manual payments: record, edit and delete with permission and stripe lock", () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store);
  const actor = {
    userId: "user-owner",
    stepUpUntil: new Date(Date.now() + 300000).toISOString(),
  };
  const base = { organizationId: "org-estancia", propertyId: "property-hotel" };
  const r = store
    .read()
    .reservations.find((r) => r.propertyId === base.propertyId)!;
  const fields = {
    concept: "prepayment",
    method: "transfer",
    amountMinor: 159000,
    status: "succeeded",
    paidOn: "2026-11-01",
    note: "SPEI",
  };
  const created = app.execute(
    actor,
    { ...base, type: "payment.record", reservationId: r.id, ...fields },
    "manual-pay-1",
  );
  let p = store.read().payments.find((x) => x.id === created.id)!;
  expect(p).toMatchObject({ concept: "prepayment", method: "transfer", provider: "manual", amountMinor: 159000 });
  expect(store.read().audits.some((a) => a.entityId === r.id && a.action === "payment.record")).toBe(true);
  app.execute(
    actor,
    { ...base, type: "payment.update", id: created.id, ...fields, amountMinor: 100000, status: "pending" },
    "manual-pay-2",
  );
  p = store.read().payments.find((x) => x.id === created.id)!;
  expect([p.amountMinor, p.status]).toEqual([100000, "pending"]);
  store.transaction((s) => {
    s.payments.find((x) => x.id === created.id)!.provider = "stripe";
  });
  expect(() =>
    app.execute(actor, { ...base, type: "payment.delete", id: created.id }, "manual-pay-3"),
  ).toThrow();
  store.transaction((s) => {
    s.payments.find((x) => x.id === created.id)!.provider = "manual";
  });
  app.execute(actor, { ...base, type: "payment.delete", id: created.id }, "manual-pay-4");
  expect(store.read().payments.some((x) => x.id === created.id)).toBe(false);
  expect(() =>
    app.execute(
      { userId: "user-housekeeping", stepUpUntil: actor.stepUpUntil },
      { ...base, type: "payment.record", reservationId: r.id, ...fields },
      "manual-pay-5",
    ),
  ).toThrow();
  store.close();
});
