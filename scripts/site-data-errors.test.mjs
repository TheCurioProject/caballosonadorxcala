import assert from "node:assert/strict";
import test from "node:test";
import { migrationErrorMessage, SafeError } from "./lib/site-data-errors.mjs";

const privateText =
  "mysql://owner:PRIVATE_PASSWORD@private.invalid/db guest@example.invalid SELECT private_data";

test("missing export tells the operator to export before validating or importing", () => {
  const result = migrationErrorMessage(
    Object.assign(new Error(privateText), { code: "ENOENT" }),
  );
  assert.match(result, /\[ENOENT\]/);
  assert.match(result, /db:export/);
  assert.ok(!result.includes(privateText));
});

test("Prisma connection and schema failures retain safe actionable codes", () => {
  for (const code of [
    "P1000",
    "P1001",
    "P1002",
    "P1011",
    "P1013",
    "P2021",
    "P2022",
    "P2028",
  ]) {
    for (const property of ["code", "errorCode"]) {
      const error = Object.assign(new Error(privateText), {
        [property]: code,
        meta: { query: privateText },
        cause: new Error(privateText),
      });
      const result = migrationErrorMessage(error);
      assert.ok(result.includes(`[${code}]`));
      assert.ok(!result.includes("PRIVATE_PASSWORD"));
      assert.ok(!result.includes("guest@example.invalid"));
      assert.ok(!result.includes("SELECT"));
    }
  }
});

test("unknown driver messages, names, codes and JSON fragments stay private", () => {
  for (const error of [
    new Error(privateText),
    new SyntaxError(privateText),
    Object.assign(new Error(privateText), {
      name: privateText,
      code: privateText,
    }),
    Object.assign(new Error(privateText), { code: `P1001\n${privateText}` }),
    Object.assign(new Error(privateText), { code: "P2999", meta: privateText }),
    null,
  ]) {
    const result = migrationErrorMessage(error);
    assert.ok(!result.includes("PRIVATE_PASSWORD"));
    assert.ok(!result.includes("guest@example.invalid"));
    assert.ok(!result.includes("SELECT"));
  }
});

test("existing backups are preserved and authored validation errors remain readable", () => {
  assert.match(migrationErrorMessage({ code: "EEXIST" }), /otro --name/);
  assert.equal(
    migrationErrorMessage(new SafeError("Export invalid or checksum mismatch")),
    "Export invalid or checksum mismatch",
  );
});
