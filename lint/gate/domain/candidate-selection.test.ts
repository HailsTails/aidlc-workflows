import { describe, expect, test } from "bun:test";
import { candidateBuildTests, needsCandidateLegacy } from "./candidate-selection.ts";

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

describe("a candidate that moves a build helper", () => {
  test("the onboarding and harness-bindings helpers need no legacy runtime suite", () => {
    const helpers = ["scripts/onboarding.ts", "scripts/harness-bindings.ts"];

    expect(needsCandidateLegacy(helpers)).toBe(false);
  });

  test("the agent-knowledge helper needs none and selects its two focused tests", () => {
    expect(needsCandidateLegacy(["scripts/agent-knowledge.ts"])).toBe(false);
    expect(candidateBuildTests(["scripts/agent-knowledge.ts"])).toEqual([
      "tests/unit/t248-steering-content-delivery.test.ts",
      "tests/unit/t-dispatched-agents-skip-format-docs.test.ts",
    ]);
  });

  test("each helper selects its own focused tests", () => {
    expect(candidateBuildTests(["scripts/onboarding.ts"])).toEqual([
      "tests/unit/t151-onboarding-skeleton.test.ts",
      "tests/unit/t239-documentation-parity.test.ts",
    ]);
    expect(candidateBuildTests(["scripts/harness-bindings.ts"])).toEqual([
      "tests/unit/t-own-harness-bindings.test.ts",
    ]);
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
