import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: [
      "tests/cala/unit/**/*.test.ts",
      "tests/cala/integration/**/*.test.ts",
      "tests/site/**/*.test.ts",
    ],
    pool: "forks",
    fileParallelism: false,
  },
});
