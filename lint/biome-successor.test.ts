import { describe, expect, test } from "bun:test";
import { BIOME_RELAXED_NON_NULL, BIOME_SUCCESSOR_RULES } from "./biome-successor.ts";

describe("Biome successor rules", () => {
  test("carry Biome's recommended correctness rules into ESLint", () => {
    expect(BIOME_SUCCESSOR_RULES).toMatchObject({
      "no-debugger": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    });
  });

  test("relax non-null assertions only where Biome relaxed them", () => {
    expect(BIOME_RELAXED_NON_NULL).toEqual([
      "tests/**/*.ts",
      "core/tools/**/*.ts",
      "harness/**/*.ts",
      "scripts/**/*.ts",
    ]);
  });
});
