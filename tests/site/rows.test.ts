import { test, expect } from "vitest";
import { allRows } from "@/cala/infrastructure/supabase/rows";
test("the snapshot reads beyond PostgREST first page and certifies completeness only after the last page", async () => {
  const rows = Array.from({ length: 1501 }, (_, id) => ({ id }));
  const calls: number[] = [];
  const result = await allRows({
    order: () => ({
      range: async (from, to) => {
        calls.push(from);
        return {
          data: rows.slice(from, to + 1),
          error: null,
          count: rows.length,
        };
      },
    }),
  });
  expect(result.data).toHaveLength(1501);
  expect(result.count).toBe(1501);
  expect(calls).toHaveLength(8);
});
test("a failed or truncated page cannot become an apparently empty successful snapshot", async () => {
  const failure = await allRows({
    order: () => ({
      range: async () => ({ data: null, error: { message: "unavailable" } }),
    }),
  });
  expect(failure.data).toBeNull();
  await expect(
    allRows({
      order: () => ({
        range: async () => ({ data: [], error: null, count: 1001 }),
      }),
    }),
  ).rejects.toThrow();
});
