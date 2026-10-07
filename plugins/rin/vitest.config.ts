import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: [
      "vitest.config.test.ts",
      "tools/**/*.test.ts",
      "hooks/**/*.test.ts",
      "harness/**/*.test.ts",
    ],
    exclude: ["tools/test-fixtures/**"],
    name: "plugins-rin",
  },
});
