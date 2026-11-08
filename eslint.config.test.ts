import { describe, expect, test } from "bun:test";
import config from "./eslint.config.ts";

describe("eslint.config.ts", () => {
  test("applies discipline-core's readability rules to the clean zone only", () => {
    expect(config).toContainEqual(
      expect.objectContaining({
        name: "discipline-core/piece/discipline-cd40",
        ignores: ["lint/gate/**/*.{ts,tsx,mts,cts}", "scripts/gate.ts"],
      }),
    );
  });

  test("keeps the interim readability rules for debt and scaffolding", () => {
    expect(config).toContainEqual(
      expect.objectContaining({ name: "aidlc/readability/debt", files: ["**/*.ts"] }),
    );
  });
});
