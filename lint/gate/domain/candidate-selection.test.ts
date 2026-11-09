import { describe, expect, test } from "bun:test";
import { needsCandidateLegacy } from "./candidate-selection.ts";

const KIRO_IDE_HOST_DATA_CHANGE = [
  "harness/kiro-ide/manifest.ts",
  "src/cli/host-table.ts",
  "src/hosts/kiro-ide/host-data.ts",
  "tests/harness/harness-matrix.ts",
];

const SETTINGS_WIRING_CHANGE = [
  "scripts/package.ts",
  "src/projection/core-root.ts",
  "src/glossary.json",
  "tests/harness/harness-matrix.ts",
];

describe("a candidate that reaches the retained matrix helper", () => {
  test("a host-data change that updates the matrix helper needs no legacy runtime suite", () => {
    expect(needsCandidateLegacy(KIRO_IDE_HOST_DATA_CHANGE)).toBe(false);
  });

  test("a settings wiring change that updates the matrix helper needs none either", () => {
    expect(needsCandidateLegacy(SETTINGS_WIRING_CHANGE)).toBe(false);
  });
});

describe("a candidate that touches shipped runtime or other test helpers", () => {
  test("a core tool still needs the legacy runtime suites", () => {
    expect(needsCandidateLegacy(["core/tools/aidlc-lib.ts"])).toBe(true);
  });

  test("another test helper still needs them", () => {
    expect(needsCandidateLegacy(["tests/harness/fixtures.ts"])).toBe(true);
  });
});
