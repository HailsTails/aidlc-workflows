import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "**/test-fixtures/**"],
    name: "plugins-discipline-core",
    testTimeout: 30_000,
  },
});
