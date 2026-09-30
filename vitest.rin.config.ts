import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["plugins/rin/**/*.test.{ts,mjs,js}"],
    exclude: [...configDefaults.exclude, "plugins/rin/**/test-fixtures/**"],
  },
});
