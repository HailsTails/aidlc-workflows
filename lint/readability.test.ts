import { describe, expect, test } from "bun:test";
import { cleanZoneConfig, INTERIM_READABILITY, interimReadabilityConfig } from "./readability.ts";

describe("cleanZoneConfig", () => {
  test("scopes each discipline block to the clean zone, never the scaffolding", () => {
    const piece = { name: "piece/cd40", files: ["**/*.{ts,tsx,mts,cts}"], rules: {} };

    expect(cleanZoneConfig([piece])).toEqual([
      {
        name: "piece/cd40",
        rules: {},
        files: [
          "src/**/*.{ts,tsx,mts,cts}",
          "lint/**/*.{ts,tsx,mts,cts}",
          "eslint.config.ts",
          "eslint.config.test.ts",
          "disciplines.eslint.d.mts",
        ],
        ignores: ["lint/gate/**/*.{ts,tsx,mts,cts}", "scripts/gate.ts"],
      },
    ]);
  });

  test("keeps an exception block on the one file it was recorded for", () => {
    const exception = { name: "exception/0", files: ["lint/no-comments.ts"], rules: {} };

    expect(cleanZoneConfig([exception])).toEqual([
      {
        name: "exception/0",
        files: ["lint/no-comments.ts"],
        rules: {},
        ignores: ["lint/gate/**/*.{ts,tsx,mts,cts}", "scripts/gate.ts"],
      },
    ]);
  });
});

describe("interimReadabilityConfig", () => {
  test("keeps the interim rules off the clean zone and on the scaffolding", () => {
    expect(interimReadabilityConfig(INTERIM_READABILITY)).toEqual([
      expect.objectContaining({
        name: "aidlc/readability/debt",
        files: ["**/*.ts"],
        ignores: [
          "src/**/*.{ts,tsx,mts,cts}",
          "lint/**/*.{ts,tsx,mts,cts}",
          "eslint.config.ts",
          "eslint.config.test.ts",
          "disciplines.eslint.d.mts",
        ],
      }),
      expect.objectContaining({
        name: "aidlc/readability/scaffolding",
        files: ["lint/gate/**/*.{ts,tsx,mts,cts}", "scripts/gate.ts"],
      }),
    ]);
  });
});
