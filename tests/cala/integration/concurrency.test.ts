import { test, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalPersistenceAdapter } from "@/cala/infrastructure/persistence/local";
import { seedState } from "../fixtures/seed";
test("two independent processes cannot sell the last unit twice", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pms-race-")),
    path = join(dir, "db.sqlite");
  const store = new LocalPersistenceAdapter(path, seedState);
  function run(key: string) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [
        "--import",
        "tsx",
        "tests/fixtures/concurrent-reservation.ts",
        path,
        key,
      ]);
      let out = "",
        err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", reject);
      child.on("close", (code) => (code ? reject(Error(err)) : resolve(out)));
    });
  }
  try {
    const result = await Promise.all([run("race-one"), run("race-two")]);
    expect(result.sort()).toEqual(["conflict", "created"]);
    expect(
      store.read().reservations.filter((r) => r.arrival === "2030-01-01"),
    ).toHaveLength(1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true });
  }
}, 30000);
