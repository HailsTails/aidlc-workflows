import { CLEAN_ZONE, SCAFFOLDING_ZONE } from "../../zones.ts";
import { testsCheck } from "../application/tests-check.ts";
import { globMatcher } from "../domain/glob.ts";
import type { TestReach } from "../domain/test-impact.ts";
import type { Command } from "../application/ports.ts";
import { describe, expect, test } from "bun:test";
import { changedLegacyCommand, legacyEnvironment, legacySuites } from "./legacy-suites.ts";

describe("legacy suites", () => {
  test("the runner environment is built from named variables, never inherited whole", () => {
    const environment = legacyEnvironment({
      PATH: "/bin",
      HOME: "/home/x",
      AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1",
      SECRET_TOKEN: "s",
    });
    expect(environment).toEqual({ PATH: "/bin", HOME: "/home/x" });
  });

  test("the runner keeps PATHEXT so a spawned shell finds a .cmd launcher on PATH", () => {
    const environment = legacyEnvironment({ PATH: "C:\bin", PATHEXT: ".COM;.EXE;.CMD" });
    expect(environment).toEqual({ PATH: "C:\bin", PATHEXT: ".COM;.EXE;.CMD" });
  });

  test("the runner keeps ComSpec so a spawned shell finds cmd.exe from a one-folder PATH", () => {
    const kept = { PATH: "C:/bin", ComSpec: "C:/Windows/System32/cmd.exe" };
    expect(legacyEnvironment(kept)).toEqual(kept);
  });

  test("both legacy suites run the repository runner with the explicit environment", () => {
    const environment = { PATH: "/bin" };
    const suites = legacySuites({ bun: "bun", environment });
    const commands = suites.filter((suite) => suite.foundationLegacy)
      .map((suite) => suite.command?.(["tests/unit/t177.test.ts"]));
    expect(commands.map((command) => command?.env)).toEqual([environment, environment]);
    expect(commands[0]?.argv).toEqual([
      "bun", "tests/run-tests.ts", "--smoke", "--filter", "^(t177)", "--no-llm",
    ]);
    expect(commands[1]?.argv).toEqual([
      "bun",
      "tests/run-tests.ts",
      "--unit",
      "--filter",
      "^(t177)",
      "--no-llm",
    ]);
  });
});

describe("legacy matrix plan", () => {
  const WEIGHTS = JSON.stringify({
    defaultSeconds: 1,
    weights: { "big.test.ts": 200, "a.test.ts": 3, "b.test.ts": 2 },
  });
  const BIG_SOURCE = 'describe("one", () => {});\ndescribe("two", () => {});';
  const workspace = {
    read: (path: string) =>
      ({
        "tests/unit-shard-weights.json": WEIGHTS,
        "tests/unit/big.test.ts": BIG_SOURCE,
      })[path],
    write: () => undefined,
    filesMatching: () => [],
  };
  const suites = legacySuites(
    { bun: "bun", environment: {} },
    { workspace, workers: 2, splitAtOrAbove: 60, targetSeconds: 150 },
  );
  const matrix = suites[1];
  const commands = matrix?.commands?.([
    "tests/unit/big.test.ts",
    "tests/unit/a.test.ts",
    "tests/unit/b.test.ts",
  ]);

  test("a heavy file splits per describe block and the rest share one run", () => {
    const patterns = commands?.map((command) => command.argv.includes("--test-name-pattern"));
    expect(patterns).toEqual([true, true, false]);
  });

  test("every shard of the heavy file selects that one file, and the others select theirs", () => {
    const filters = commands?.map((command) => command.argv[command.argv.indexOf("--filter") + 1]);
    expect(filters).toEqual(["^(big)", "^(big)", "^(a|b)"]);
  });

  test("the suite declares how many runs go side by side", () => {
    expect(matrix?.concurrency).toBe(2);
  });
});

describe("legacy transpiler cache", () => {
  test("a given cache folder is the only addition to the named variables", () => {
    const environment = legacyEnvironment({ PATH: "/bin", SECRET: "s" }, "/cache");
    expect(environment).toEqual({ PATH: "/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "/cache" });
  });
});

const STARTUP_FILE = "tests/harness/harness-matrix.ts";
const STARTUP_COMMAND = ["bun", STARTUP_FILE];

const LEGACY_FILES = [
  "tests/smoke/s.test.ts", "tests/unit/a.test.ts", "tests/unit/b.test.ts",
  "tests/unit/uncovered.test.ts",
];
const ALL_LEGACY = [
  ["bun", "tests/run-tests.ts", "--smoke", "--filter", "^(s)", "--no-llm"],
  ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(a|b)", "--no-llm"],
];
const KNOWN_LEGACY = [
  ["bun", "tests/run-tests.ts", "--smoke", "--filter", "^(s)", "--no-llm"],
  ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(a)", "--no-llm"],
];

const selectedLegacy = async (
  changed: readonly string[], loose = false,
  smoke: {
    readonly reach?: TestReach; readonly files?: readonly string[]; readonly everything?: boolean;
  } = {},
): Promise<readonly string[][]> => {
  const commands: string[][] = [];
  const capture = (command: Command) => {
    commands.push([...command.argv]);
    return { exitCode: 0, output: "" };
  };
  const check = testsCheck({
    runner: { capture, captureAll: async () => [], attach: () => 0 },
    workspace: {
      read: (path) =>
        path.includes("uncovered") ? "" : 'import { x } from "../harness/harness-matrix.ts";',
      write: () => undefined,
      filesMatching: (globs) => [...(smoke.files ?? LEGACY_FILES), STARTUP_FILE]
        .filter(globMatcher(globs)),
    },
    suites: legacySuites({ bun: "bun", environment: {} }),
    looseTests: loose ? ["tests/**/*.test.ts"] : [],
    testCommand: (files) => ({ label: "loose tests", argv: ["bun", "test", ...files] }),
    looseCommand: (files) => changedLegacyCommand({ bun: "bun", environment: {} }, files),
    capabilities: { probe: () => ({ available: true, evidence: "fixture" }) },
    exclusions: [], build: { ensure: () => undefined },
    reachOf: () => ({
      ...smoke.reach,
      "tests/unit/a.test.ts": ["core/a.ts"],
      "tests/unit/b.test.ts": ["core/b.ts"],
    }),
  });
  await check.run({
    lane: undefined, base: { ref: "foundation", commit: "abc" },
    changes: changed.map((path) => ({ path, kind: "modified" })),
    everything: smoke.everything ?? false, build: false, record: false, allTests: false,
    heavy: { ensure: async () => ({ acquired: true }) },
  });
  return commands;
};

describe("legacy admission preserves conservative impact selection", () => {
  test.each([
    "package.json", "bun.lock", "bunfig.toml",
    "tsconfig.json", "tsconfig.tests.json", "tests/run-tests.ts",
    "tests/unit-shard-weights.json", "tests/lib/shared.ts", "tests/golden/kiro.json",
    "tests/harness/shared.ts", "tests/fixtures/input.json",
    "tests/fixtures/input.test.ts", "tests/unit/support.ts", "docs/tool.ts",
  ])("global input %s admits every legacy test", async (path) => {
    expect(await selectedLegacy([path])).toEqual(ALL_LEGACY);
  });

  test("a known source change still selects only its reachable matrix file", async () => {
    expect(await selectedLegacy(["core/a.ts"])).toEqual(KNOWN_LEGACY);
  });

  test("an unknown path outside the old trigger families selects everything", async () => {
    expect(await selectedLegacy(["unknown/path.ts"])).toEqual(ALL_LEGACY);
  });

  test("a mixed known and unknown change cannot silently drop the unknown impact", async () => {
    expect(await selectedLegacy(["core/a.ts", "unknown/path.ts"])).toEqual(ALL_LEGACY);
  });

  test("an ordinary scoped run with no changes selects nothing", async () => {
    expect(await selectedLegacy([])).toEqual([]);
  });
});

describe("selected legacy files run once", () => {
  test("a changed matrix file is not also a loose test", async () => {
    const commands = await selectedLegacy(["tests/unit/a.test.ts"], true);
    expect(commands).toEqual([
      ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(a)", "--no-llm"],
    ]);
  });
  test("a changed smoke file is not also a loose test", async () => {
    expect(await selectedLegacy(["tests/smoke/s.test.ts"], true)).toEqual([
      ["bun", "tests/run-tests.ts", "--smoke", "--filter", "^(s)", "--no-llm"],
    ]);
  });
  test("a changed unit outside the actual matrix followers stays loose", async () => {
    expect(await selectedLegacy(["tests/unit/uncovered.test.ts"], true)).toEqual([
      ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(uncovered)", "--no-llm"],
    ]);
  });
});


describe("smoke impact uses the existing conservative selector", () => {
  const reach = { "tests/smoke/s.test.ts": ["core/a.ts", "core/b.ts"] };
  test("a known smoke dependency selects its file with the runner filter", async () => {
    expect(await selectedLegacy(["core/a.ts"], false, { reach })).toEqual(KNOWN_LEGACY);
  });
  test("a known unimpacted smoke file is omitted", async () => {
    const known = { ...reach, "tests/smoke/other.test.ts": ["core/b.ts"] };
    expect(await selectedLegacy(["core/a.ts"], false, {
      reach: known, files: [...LEGACY_FILES, "tests/smoke/other.test.ts"],
    })).toEqual(KNOWN_LEGACY);
  });
});


describe("Phase 1 candidates rely on the enforced foundation sweep", () => {
  test.each(["src/projection/render.ts", "scripts/package.ts", "lint/gate/domain/x.ts",
    "docs/reference/15-stage-definition.md"])(
    "%s defers legacy suites", async (path) => {
      expect(await selectedLegacy([path])).toEqual([]);
    },
  );
  test("runtime edits still select their impacted matrix", async () => {
    expect(await selectedLegacy(["core/a.ts"])).toEqual(KNOWN_LEGACY);
  });
  test("mixing a Phase 1 path with an unknown path remains conservative", async () => {
    expect(await selectedLegacy(["src/projection/render.ts", "unknown/x"])).toEqual(ALL_LEGACY);
  });
});


test("uncovered changed legacy files use the repository runner and their levels", () => {
  const command = changedLegacyCommand({ bun: "bun", environment: { PATH: "native" } }, [
    "tests/unit/uncovered.test.ts", "tests/integration/contract.test.ts",
  ]);
  expect(command.argv).toEqual([
    "bun", "tests/run-tests.ts", "--unit", "--integration",
    "--filter", "^(uncovered|contract)", "--no-llm",
  ]);
  expect(command.env).toEqual({ PATH: "native" });
});


const Q15_CHANGES = [
  "discipline-exceptions.json",
  "docs/reference/15-stage-definition.md",
  "harness/kiro-ide/manifest.ts",
  "lint/context-map.test.ts",
  "lint/context-map.ts",
  "lint/isolation-offenders.txt",
  "scripts/package.ts",
  "src/cli/core-build-root.test.ts",
  "src/cli/core-build-root.ts",
  "src/cli/main.test.ts",
  "src/cli/main.ts",
  "src/cli/package-build-root.test.ts",
  "src/cli/package-build-root.ts",
  "src/glossary.json",
  "src/projection/adapters/compiled-method-file.ts",
  "src/projection/adapters/host-source-files.test.ts",
  "src/projection/adapters/host-source-files.ts",
  "src/projection/adapters/legacy-runners.ts",
  "src/projection/adapters/prepared-host-source.test.ts",
  "src/projection/adapters/prepared-host-source.ts",
  "src/projection/application/host-source-files.test.ts",
  "src/projection/application/host-source-files.ts",
  "src/projection/application/ports.ts",
  "src/projection/application/prepared-host-source.test.ts",
  "src/projection/application/prepared-host-source.ts",
  "src/projection/core-root.test.ts",
  "src/projection/core-root.ts",
  "src/workflow-definition/application/core-admission.test.ts",
  "src/workflow-definition/application/use-cases.ts",
  "src/workflow-definition/core-root.test.ts",
  "src/workflow-definition/core-root.ts",
  "tests/unit/t248-steering-content-delivery.test.ts",
  "tests/unit/t64.test.ts",
];

test("the complete Q15 diff runs only its changed legacy tests", async () => {
  expect(await selectedLegacy(Q15_CHANGES, true)).toEqual([STARTUP_COMMAND, [
    "bun", "tests/run-tests.ts", "--unit", "--filter",
    "^(t248-steering-content-delivery|t64)", "--no-llm",
  ]]);
});

test.each([...CLEAN_ZONE.files, ...SCAFFOLDING_ZONE.files])(
  "known gate input %s does not admit legacy suites", async (path) => {
    expect(await selectedLegacy([path])).toEqual([]);
  },
);


test("runtime plus a changed covered test still runs that test only once", async () => {
  expect(await selectedLegacy(["core/a.ts", "tests/unit/a.test.ts"], true)).toEqual(KNOWN_LEGACY);
});

const C1_CHANGES = [
  "harness/claude/manifest.ts",
  "scripts/earlier-release-regions.ts",
  "scripts/package.ts",
  "src/cli/host-table.ts",
  "src/cli/main.test.ts",
  "src/cli/package-build-root.test.ts",
  "src/cli/package-build-root.ts",
  "src/cli/roots.ts",
  "src/hosts/claude/projection/skill-renderer.test.ts",
  "src/hosts/claude/projection/skill-renderer.ts",
  "src/projection/adapters/legacy-skill-tables.test.ts",
  "src/projection/adapters/legacy-skill-tables.ts",
  "src/projection/adapters/session-skill-files.test.ts",
  "src/projection/adapters/session-skill-files.ts",
  "src/projection/application/ports.ts",
  "src/projection/application/project-method-skills.test.ts",
  "src/projection/application/project-method-skills.ts",
  "src/projection/core-root.test.ts",
  "src/projection/core-root.ts",
  "src/projection/domain/skill-regions.test.ts",
  "src/projection/domain/skill-regions.ts",
  "src/projection/domain/token-binding.test.ts",
  "src/projection/domain/token-binding.ts"
];

const REGION_TESTS = [
  "tests/unit/t-earlier-release-refresh-regions.test.ts",
  "tests/unit/t-earlier-skill-tables-refresh.test.ts",
  "tests/unit/t-skill-body-carriers.test.ts",
];
const REGION_FILTER = "^(t-earlier-release-refresh-regions|" +
  "t-earlier-skill-tables-refresh|t-skill-body-carriers)";
const REGION_INPUT = "scripts/earlier-release-regions.ts";
const REGION_COMMAND = [
  "bun", "tests/run-tests.ts", "--unit", "--filter", REGION_FILTER, "--no-llm",
];

test("the exact build adapter runs three compatibility tests, not smoke or matrix", async () => {
  expect(await selectedLegacy([REGION_INPUT], true)).toEqual([REGION_COMMAND]);
});

test("the complete immutable C1 diff selects only three legacy compatibility files", async () => {
  expect(await selectedLegacy(C1_CHANGES, true)).toEqual([STARTUP_COMMAND, REGION_COMMAND]);
});

test("a changed mapped compatibility test still runs once", async () => {
  expect(await selectedLegacy([REGION_INPUT, ...REGION_TESTS], true)).toEqual([REGION_COMMAND]);
});

test("an unrelated changed test is retained alongside the mapped build tests", async () => {
  const commands = await selectedLegacy([REGION_INPUT, "tests/unit/uncovered.test.ts"], true);
  expect(commands).toEqual([[
    "bun", "tests/run-tests.ts", "--unit", "--filter",
    "^(uncovered|t-earlier-release-refresh-regions|" +
      "t-earlier-skill-tables-refresh|t-skill-body-carriers)",
    "--no-llm",
  ]]);
});

test("runtime plus build adapter keeps conservative matrix coverage once", async () => {
  const commands = await selectedLegacy([REGION_INPUT, "core/a.ts"], true, {
    files: [...LEGACY_FILES, ...REGION_TESTS],
  });
  expect(commands).toEqual([
    ["bun", "tests/run-tests.ts", "--smoke", "--filter", "^(s)", "--no-llm"],
    ["bun", "tests/run-tests.ts", "--unit", "--filter",
      "^(a|b|t-earlier-release-refresh-regions|" +
        "t-earlier-skill-tables-refresh|t-skill-body-carriers)",
      "--no-llm"],
  ]);
});

test("an unclassified script still admits the full conservative selection", async () => {
  expect(await selectedLegacy(["scripts/unknown.ts"], true)).toEqual(ALL_LEGACY);
});


test("full runs do not add a mapped-test command beside selected suites", async () => {
  const files = [...LEGACY_FILES, ...REGION_TESTS];
  const full = { files, everything: true };
  const commands = await selectedLegacy([REGION_INPUT], true, full);
  expect(commands).toHaveLength(3);
  expect(commands[2]).toEqual(STARTUP_COMMAND);
  expect(commands[0]).toEqual(ALL_LEGACY[0]);
  expect(commands[1]?.join(" ")).toContain("^(a|b|t-earlier-release-refresh-regions|");
});


test.each(["claude", "codex", "copilot", "cursor", "kiro", "kiro-ide", "opencode"])(
  "%s manifest selects existing startup validation, not matrix scenarios", async (host) => {
    expect(await selectedLegacy([`harness/${host}/manifest.ts`], true)).toEqual([STARTUP_COMMAND]);
  },
);
