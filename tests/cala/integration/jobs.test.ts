import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";
import {
  MockMigrationProvider,
  MockDistributionProvider,
} from "../fixtures/providers";
import { DevelopmentJobScheduler } from "../fixtures/job-scheduler";
const actor = { userId: "user-owner", stepUpUntil: null };
const base = { organizationId: "org-estancia", propertyId: "property-hotel" };
function setup() {
  const store = new LocalPersistenceAdapter(":memory:", seedState);
  const service = new ApplicationService(store);
  const scheduler = new DevelopmentJobScheduler(
    store,
    new MockMigrationProvider(),
    new MockDistributionProvider(),
  );
  return { store, service, scheduler };
}
async function tick(
  store: LocalPersistenceAdapter,
  scheduler: DevelopmentJobScheduler,
) {
  store.transaction((s) => {
    for (const j of s.jobs) j.runAfter = "2000-01-01T00:00:00Z";
  });
  await scheduler.tick();
}
test("migration stages, user review, import reconciliation and repeat dedupe", async () => {
  const { store, service, scheduler } = setup();
  const run = async (key: string) => {
    const job = service.execute(
      actor,
      { ...base, type: "migration.start", includeConflicts: true },
      key,
    );
    for (
      let i = 0;
      i < 15 &&
      store.read().jobs.find((j) => j.id === job.id)?.status !== "review";
      i++
    )
      await tick(store, scheduler);
    const review = store.read().jobs.find((j) => j.id === job.id)!;
    expect(review.status).toBe("review");
    expect(store.read().externalIdentities).toHaveLength(
      key === "first-job" ? 0 : 4,
    );
    expect(() =>
      service.execute(
        actor,
        { ...base, type: "migration.review", id: job.id, excludeIds: [] },
        key + "bad",
      ),
    ).toThrow(/conflicto/);
    service.execute(
      actor,
      {
        ...base,
        type: "migration.review",
        id: job.id,
        excludeIds: ["fixture-conflict"],
      },
      key + "review",
    );
    for (let i = 0; i < 4; i++) await tick(store, scheduler);
    expect(store.read().jobs.find((j) => j.id === job.id)?.status).toBe(
      "completed",
    );
  };
  await run("first-job");
  const count = store.read().reservations.length;
  await run("second-job");
  expect(store.read().reservations).toHaveLength(count);
  expect(store.read().externalIdentities).toHaveLength(4);
  store.close();
});
test("provider retries reach dead letter and recover without duplicating jobs", async () => {
  const { store, service, scheduler } = setup();
  store.transaction((s) => {
    s.channels[0].simulateFailure = true;
  });
  const job = service.execute(
    actor,
    { ...base, type: "channel.sync", id: "channel-hotel" },
    "sync-demo-key",
  );
  for (let i = 0; i < 4; i++) await tick(store, scheduler);
  expect(store.read().jobs.find((j) => j.id === job.id)?.status).toBe(
    "dead_letter",
  );
  store.transaction((s) => {
    s.channels[0].simulateFailure = false;
  });
  service.execute(
    actor,
    { ...base, type: "job.retry", id: job.id },
    "retry-demo-key",
  );
  await tick(store, scheduler);
  expect(store.read().jobs.find((j) => j.id === job.id)?.status).toBe(
    "completed",
  );
  expect(store.read().channels[0].status).toBe("connected");
  store.close();
});
test("job lease prevents double execution and suspended actor fails closed", async () => {
  const { store, service, scheduler } = setup();
  service.execute(
    actor,
    { ...base, type: "migration.start", includeConflicts: false },
    "leased-job",
  );
  store.transaction((s) => {
    s.jobs[0].lockedUntil = new Date(Date.now() + 60000).toISOString();
    s.jobs[0].lockToken = "other-worker";
    s.jobs[0].status = "running";
  });
  expect(await scheduler.tick()).toBe(false);
  store.transaction((s) => {
    s.jobs[0].lockedUntil = "2000-01-01T00:00:00Z";
    s.memberships[0].status = "suspended";
  });
  await scheduler.tick();
  expect(store.read().jobs[0].status).toBe("dead_letter");
  store.close();
});
