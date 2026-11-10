import { test, expect } from "vitest";
import { parseCalendar, exportCalendar } from "@/cala/domain/distribution/ical";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { ApplicationService } from "@/cala/application/service";
import { IcalJobRunner } from "@/cala/application/jobs/ical-runner";
import { snapshot } from "@/cala/application/queries";
const text =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test-1\r\nDTSTART;VALUE=DATE:20310101\r\nDTEND;VALUE=DATE:20310103\r\nSEQUENCE:1\r\nDTSTAMP:20260922T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
test("iCal imports durable blocks, deduplicates, propagates cancellation and prevents loops", async () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store),
    worker = new IcalJobRunner(store);
  const actor = { userId: "user-owner", stepUpUntil: null },
    base = {
      organizationId: "org-estancia",
      propertyId: "property-hotel",
      unitId: "unit-hotel-1",
    };
  async function run(content: string, key: string) {
    const r = app.execute(
      actor,
      { ...base, type: "ical.import", calendar: "source-A", content },
      key,
    );
    for (
      let i = 0;
      i < 10 &&
      store.read().jobs.find((j) => j.id === r.id)?.status !== "completed";
      i++
    ) {
      store.transaction((s) => {
        for (const j of s.jobs) j.runAfter = "2000-01-01T00:00:00Z";
      });
      await worker.tick();
    }
    expect(store.read().jobs.find((j) => j.id === r.id)?.status).toBe(
      "completed",
    );
  }
  await run(text, "ical-first");
  const count = store.read().blocks.length;
  await run(text, "ical-repeat");
  expect(store.read().blocks).toHaveLength(count);
  await run(
    text.replace("SEQUENCE:1", "SEQUENCE:2\r\nSTATUS:CANCELLED"),
    "ical-cancel",
  );
  expect(store.read().blocks.at(-1)?.active).toBe(false);
  await run(text.replace("UID:test-1", "UID:test-1@cala.local"), "ical-own");
  expect(store.read().blocks).toHaveLength(count);
  const first = app.execute(
    actor,
    { ...base, type: "ical.rotate" },
    "feed-rotate1",
  );
  const hash = store.read().icalFeeds![0].tokenHash;
  expect(first.secretUrl).toContain("/api/ical?token=");
  expect(snapshot(store.read(), actor)).not.toHaveProperty("icalFeeds");
  app.execute(actor, { ...base, type: "ical.rotate" }, "feed-rotate2");
  expect(store.read().icalFeeds![0].tokenHash).not.toBe(hash);
  app.execute(actor, { ...base, type: "ical.revoke" }, "feed-revoke");
  expect(store.read().icalFeeds).toHaveLength(0);
  store.close();
});
test("iCal export carries no PII and rejects unsupported timed/recurring input", () => {
  const events = parseCalendar(text);
  const output = exportCalendar(events, "20260922T120000Z");
  expect(output).toContain("SUMMARY:No disponible");
  expect(output).not.toContain("DESCRIPTION:");
  expect(() =>
    parseCalendar(text.replace("SEQUENCE:1", "RRULE:FREQ=DAILY")),
  ).toThrow(/recurrencias/);
  expect(() =>
    parseCalendar(
      text.replace("DTSTART;VALUE=DATE:20310101", "DTSTART:20310101T120000Z"),
    ),
  ).toThrow();
});

test("iCal runner recovers an expired lease and rechecks permissions before applying a durable job", async () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store),
    worker = new IcalJobRunner(store);
  const actor = { userId: "user-owner", stepUpUntil: null },
    base = {
      organizationId: "org-estancia",
      propertyId: "property-hotel",
      unitId: "unit-hotel-1",
      type: "ical.import",
      calendar: "recovery",
      content: text,
    };
  try {
    const job = app.execute(actor, base, "ical-recover-job");
    store.transaction((s) => {
      Object.assign(
        s.jobs.find((j) => j.id === job.id)!,
        {
          status: "running",
          lockToken: "abandoned-worker",
          lockedUntil: "2000-01-01T00:00:00Z",
        },
      );
    });
    expect(await worker.tick()).toBe(true);
    expect(store.read().jobs.find((j) => j.id === job.id)).toMatchObject({
      status: "completed",
      progress: 100,
      lockToken: null,
    });
    const revoked = app.execute(
      actor,
      {
        ...base,
        calendar: "revoked",
        content: text.replace("UID:test-1", "UID:revoked-event"),
      },
      "ical-revoked-job",
    );
    const count = store.read().blocks.length;
    store.transaction((s) => {
      s.memberships.find((m) => m.userId === actor.userId)!.status =
        "suspended";
    });
    await worker.tick();
    expect(store.read().blocks).toHaveLength(count);
    expect(store.read().jobs.find((j) => j.id === revoked.id)).toMatchObject({
      status: "dead_letter",
      attempts: 1,
      lockToken: null,
    });
  } finally {
    store.close();
  }
});

test("iCal runner rolls back the entire file on a conflict and leaves unrelated job types untouched", async () => {
  const store = new LocalPersistenceAdapter(":memory:", seedState),
    app = new ApplicationService(store),
    worker = new IcalJobRunner(store);
  try {
    const state = store.read(),
      occupied = state.reservations.find(
        (r) => r.propertyId === "property-hotel" && r.unitId === "unit-hotel-1",
      )!;
    const conflicting = text
      .replace("UID:test-1", "UID:conflicting-event")
      .replace("20310101", occupied.arrival.replaceAll("-", ""))
      .replace("20310103", occupied.departure.replaceAll("-", ""));
    const content = text.replace(
      "END:VCALENDAR",
      conflicting.slice(conflicting.indexOf("BEGIN:VEVENT")),
    );
    const job = app.execute(
      { userId: "user-owner", stepUpUntil: null },
      {
        type: "ical.import",
        organizationId: "org-estancia",
        propertyId: "property-hotel",
        unitId: "unit-hotel-1",
        calendar: "rollback",
        content,
      },
      "ical-rollback-file",
    );
    const count = store.read().blocks.length;
    await worker.tick();
    expect(store.read().blocks).toHaveLength(count);
    expect(store.read().icalEvents ?? []).toHaveLength(0);
    expect(store.read().jobs.find((j) => j.id === job.id)?.status).toBe(
      "dead_letter",
    );
    store.transaction((s) => {
      s.jobs.push({
        ...s.jobs[0],
        id: "report-waiting",
        type: "report",
        status: "queued",
        runAfter: "2000-01-01T00:00:00Z",
        lockedUntil: null,
        lockToken: null,
      });
    });
    expect(await worker.tick()).toBe(false);
    expect(
      store.read().jobs.find((j) => j.id === "report-waiting")?.status,
    ).toBe("queued");
  } finally {
    store.close();
  }
});
