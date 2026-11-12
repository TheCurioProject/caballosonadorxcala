import { invariant } from "@/cala/domain/shared/errors";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { State } from "@/cala/domain/model";
import type { PersistenceAdapter } from "@/cala/application/ports/persistence";

function migrateState(
  raw: unknown,
  seed: () => State,
  purgeSampleData = false,
): State {
  if (!raw || typeof raw !== "object") return seed();
  const state = structuredClone(raw) as Record<string, unknown>;
  const users = Array.isArray(state.users) ? state.users : [];
  const audits = Array.isArray(state.audits) ? state.audits : [];
  if (
    purgeSampleData &&
    (users.some(
      (user) =>
        user &&
        typeof user === "object" &&
        String((user as Record<string, unknown>).email ?? "").endsWith(
          "@example.test",
        ),
    ) ||
      audits.some(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          (entry as Record<string, unknown>).action === "development.seed",
      ))
  )
    return seed();
  if (!Array.isArray(state.payments) || !Array.isArray(state.jobs))
    return seed();
  if (!Array.isArray(state.credentials)) state.credentials = [];
  state.payments = state.payments
    .filter(
      (payment) =>
        !payment ||
        typeof payment !== "object" ||
        (payment as Record<string, unknown>).kind !== "refund",
    )
    .map((payment) => {
      if (!payment || typeof payment !== "object") return payment;
      const next = { ...(payment as Record<string, unknown>) };
      delete next.kind;
      delete next.parentPaymentId;
      return next;
    })
    .map((payment) => {
      if (!payment || typeof payment !== "object") return payment;
      const next = payment as Record<string, unknown>;
      next.concept ??= "payment";
      next.method ??= "";
      next.note ??= "";
      return next;
    });
  state.jobs = state.jobs.filter((job) => {
    if (!job || typeof job !== "object") return true;
    const type = (job as Record<string, unknown>).type;
    return type !== "message" && type !== "refund";
  });
  if (Array.isArray(state.audits))
    state.audits = state.audits.filter((entry) => {
      if (!entry || typeof entry !== "object") return true;
      const action = (entry as Record<string, unknown>).action;
      return action !== "message.send" && action !== "payment.refund";
    });
  delete state.messages;
  for (const key of [
    "workspacePreferences",
    "conversations",
    "messageEntries",
    "messageTemplates",
    "marketObservations",
  ])
    if (!Array.isArray(state[key])) state[key] = [];
  state.schemaVersion = 2;
  return state as unknown as State;
}

export class LocalPersistenceAdapter implements PersistenceAdapter {
  private db: DatabaseSync;
  constructor(path: string, seed: () => State, purgeSampleData = false) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS development_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.db
        .prepare("SELECT payload FROM development_state WHERE id=1")
        .get() as { payload: string } | undefined;
      if (!existing)
        this.db
          .prepare("INSERT INTO development_state VALUES(1,?)")
          .run(JSON.stringify(seed()));
      else
        this.db
          .prepare("UPDATE development_state SET payload=? WHERE id=1")
          .run(
            JSON.stringify(
              migrateState(JSON.parse(existing.payload), seed, purgeSampleData),
            ),
          );
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  read(): State {
    const row = this.db
      .prepare("SELECT payload FROM development_state WHERE id=1")
      .get() as { payload: string };
    return migrateState(JSON.parse(row.payload), () => {
      throw new Error("El estado local no tiene una estructura válida.");
    });
  }
  transaction<T>(work: (state: State) => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const state = this.read();
      const result = work(state);
      if (result instanceof Promise)
        throw Error("Async callbacks are prohibited inside local transactions");
      this.db
        .prepare("UPDATE development_state SET payload=? WHERE id=1")
        .run(JSON.stringify(state));
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  limit(key: string, max: number, windowMs = 60000) {
    const now = Date.now();
    const row = this.db
      .prepare(
        "INSERT INTO request_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires <= ? THEN 1 ELSE count+1 END, expires=CASE WHEN expires <= ? THEN excluded.expires ELSE expires END RETURNING count",
      )
      .get(key, now + windowMs, now, now) as { count: number };
    invariant(
      row.count <= max,
      "RATE_LIMITED",
      "Demasiadas solicitudes. Espera un minuto antes de reintentar.",
      429,
    );
    this.db
      .prepare("DELETE FROM request_limits WHERE expires < ?")
      .run(now - windowMs);
  }
  close() {
    this.db.close();
  }
}
