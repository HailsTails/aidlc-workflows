import { describe, expect, test } from "vitest";
import config from "./vitest.config.ts";

describe("Rin plugin Vitest configuration", () => {
  test("includes tool and per-harness unit tests from the plugin root", () => {
    expect(config.root).toBe(import.meta.dirname);
    expect(config.test?.include).toEqual([
      "vitest.config.test.ts",
      "tools/**/*.test.ts",
      "hooks/**/*.test.ts",
      "harness/**/*.test.ts",
    ]);
  });
});
