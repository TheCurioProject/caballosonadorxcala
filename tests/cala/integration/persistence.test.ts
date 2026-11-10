import { test, expect } from "vitest";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
test("transaction rollback and durable restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "pms-test-"));
  const path = join(dir, "test.sqlite");
  const s = new LocalPersistenceAdapter(path, seedState);
  expect(() =>
    s.transaction((d) => {
      d.organizations[0].name = "lost";
      throw Error("rollback");
    }),
  ).toThrow();
  expect(s.read().organizations[0].name).toBe("Grupo Estancia");
  s.transaction((d) => {
    d.organizations[0].name = "Persistida";
  });
  s.close();
  const reopened = new LocalPersistenceAdapter(path, seedState);
  expect(reopened.read().organizations[0].name).toBe("Persistida");
  reopened.close();
  rmSync(dir, { recursive: true });
});

test("version 1 state removes retired messaging and refund data", () => {
  const dir = mkdtempSync(join(tmpdir(), "pms-migration-"));
  const path = join(dir, "test.sqlite");
  const initial = new LocalPersistenceAdapter(path, seedState);
  initial.close();

  const database = new DatabaseSync(path);
  const row = database
    .prepare("SELECT payload FROM development_state WHERE id=1")
    .get() as { payload: string };
  const legacy = JSON.parse(row.payload) as Record<string, unknown>;
  legacy.schemaVersion = 1;
  legacy.messages = [{ id: "legacy-message" }];
  legacy.payments = [
    ...((legacy.payments as Record<string, unknown>[]).map((payment) => ({
      ...payment,
      kind: "payment",
      parentPaymentId: null,
    })) ?? []),
    {
      id: "legacy-refund",
      kind: "refund",
      parentPaymentId: "payment-0",
    },
  ];
  legacy.jobs = [{ id: "legacy-job", type: "message" }];
  database
    .prepare("UPDATE development_state SET payload=? WHERE id=1")
    .run(JSON.stringify(legacy));
  database.close();

  const migrated = new LocalPersistenceAdapter(path, seedState);
  const state = migrated.read();
  expect(state.schemaVersion).toBe(2);
  expect(state).not.toHaveProperty("messages");
  expect(state.jobs).toHaveLength(0);
  expect(state.payments.some((payment) => payment.id === "legacy-refund")).toBe(
    false,
  );
  expect(state.payments[0]).not.toHaveProperty("kind");
  expect(state.payments[0]).not.toHaveProperty("parentPaymentId");
  migrated.close();
  rmSync(dir, { recursive: true });
});
