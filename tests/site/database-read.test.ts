import { test, expect } from "vitest";
import { databaseRead } from "../../src/lib/database-read";
test("a closed idle read reconnects once and genuine permission errors are returned", async () => {
  let calls = 0;
  const result = await databaseRead(async () => {
    if (++calls === 1)
      throw Object.assign(new Error("private driver text"), { code: "P1017" });
    return ["reconnected"];
  });
  expect(result).toEqual(["reconnected"]);
  expect(calls).toBe(2);
  calls = 0;
  await expect(
    databaseRead(async () => {
      calls++;
      throw Object.assign(new Error("credentials rejected"), { code: "P1000" });
    }),
  ).rejects.toThrow("credentials rejected");
  expect(calls).toBe(1);
});
