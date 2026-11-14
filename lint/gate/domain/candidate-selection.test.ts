import { describe, expect, test } from "bun:test";
import {
  candidateBuildTests,
  needsCandidateLegacy,
  testsNamingDeleted,
} from "./candidate-selection.ts";

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
  test("the agent-knowledge helper needs none and selects its two focused tests", () => {
    expect(needsCandidateLegacy(["scripts/agent-knowledge.ts"])).toBe(false);
    expect(candidateBuildTests(["scripts/agent-knowledge.ts"])).toEqual([
      "tests/unit/t248-steering-content-delivery.test.ts",
      "tests/unit/t-dispatched-agents-skip-format-docs.test.ts",
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

describe("a candidate that deletes a file", () => {
  const texts: Readonly<Record<string, string>> = {
    "tests/unit/names-it.test.ts": "const path = 'harness/claude/onboarding.fills.ts';",
    "tests/unit/names-another.test.ts": "const path = 'harness/codex/onboarding.fills.ts';",
    "tests/unit/names-none.test.ts": "const path = 'src/cli/main.ts';",
  };
  const request = (deleted: readonly string[]) => ({
    deleted,
    tests: Object.keys(texts),
    textOf: (test: string) => texts[test] ?? "",
  });

  test("selects the tests whose text names the deleted file", () => {
    expect(testsNamingDeleted(request(["harness/claude/onboarding.fills.ts"]))).toEqual([
      "tests/unit/names-it.test.ts",
    ]);
  });

  test("selects a test that builds the path from its segments", () => {
    const built: Readonly<Record<string, string>> = {
      "tests/unit/builds-it.test.ts": 'readFileSync(join(REPO, "harness", h, "emit.ts"))',
      "tests/unit/templates-it.test.ts": ["readFileSync(`harness/", "$", "{h}/emit.ts`)"].join(""),
      "tests/unit/other-file.test.ts": 'join(REPO, "harness", h, "manifest.ts")',
    };
    const selected = testsNamingDeleted({
      deleted: ["harness/codex/emit.ts"],
      tests: Object.keys(built),
      textOf: (test) => built[test] ?? "",
    });

    expect(selected).toEqual(["tests/unit/builds-it.test.ts", "tests/unit/templates-it.test.ts"]);
  });

  test("selects nothing when nothing is deleted", () => {
    expect(testsNamingDeleted(request([]))).toEqual([]);
  });
});

describe("a candidate that moves only the gate's ratchet records", () => {
  test("a host's retired records need no legacy runtime suite", () => {
    const records = [
      "lint/boundary-baseline.json",
      "tests/ratchets/monolith-lines.json",
      "tests/ratchets/harness-kiro-manifest-declarations.txt",
    ];

    expect(needsCandidateLegacy(records)).toBe(false);
  });
});
