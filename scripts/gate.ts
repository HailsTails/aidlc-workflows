import { previousRelease } from "../lint/gate/adapters/previous-release.ts";
import { sweepLedger } from "../lint/gate/adapters/sweep-ledger.ts";
import { fileURLToPath } from "node:url";
import { MONOLITH_FILES } from "../lint/context-map.ts";
import { OWNER_REGISTRY_FILES } from "../lint/glossary.ts";
import { CLEAN_ZONE } from "../lint/zones.ts";
import { gateRequestFrom, slotPolicyFrom, USAGE } from "../lint/gate/adapters/cli-arguments.ts";
import {
  consoleProgress,
  printDebt,
  printProblem,
  summaryLine,
  usageSummaryLine,
} from "../lint/gate/adapters/console-report.ts";
import {
  besideMainCheckout,
  directoryLock,
  lockDirectoryBesideMainCheckout,
} from "../lint/gate/adapters/directory-lock.ts";
import { disciplineCore } from "../lint/gate/adapters/discipline-core.ts";
import { disciplinesFiles } from "../lint/gate/adapters/disciplines-files.ts";
import { eslintLinter } from "../lint/gate/adapters/eslint-linter.ts";
import { fileWorkspace } from "../lint/gate/adapters/file-workspace.ts";
import { gitRepository, sweepTree } from "../lint/gate/adapters/git-repository.ts";
import {
  goldenSource,
  goldenStore,
  type GoldenLayout,
} from "../lint/gate/adapters/golden-files.ts";
import { jsonReader } from "../lint/gate/adapters/json-reader.ts";
import { lanesFile } from "../lint/gate/adapters/lanes-file.ts";
import { nameListFile } from "../lint/gate/adapters/name-list-file.ts";
import { processRunner } from "../lint/gate/adapters/process-runner.ts";
import { runTemp } from "../lint/gate/adapters/run-temp.ts";
import { ratchetRecords } from "../lint/gate/adapters/ratchet-records.ts";
import {
  LIB_DECLARATIONS,
  MEMBER_TYPES,
  MONOLITH_TEST,
  RECORD_LOCATIONS,
} from "../lint/gate/adapters/record-locations.ts";
import { capabilityProbes } from "../lint/gate/adapters/capability-probes.ts";
import { environmentExclusions } from "../lint/gate/adapters/environment-exclusions.ts";
import { testReach } from "../lint/gate/adapters/test-reach.ts";
import { transpilerCacheFolder } from "../lint/gate/adapters/transpiler-cache.ts";
import {
  changedLegacyCommand, legacyEnvironment, legacySuites,
} from "../lint/gate/adapters/legacy-suites.ts";
import { sourceSuites } from "../lint/gate/adapters/source-suites.ts";
import { systemClock } from "../lint/gate/adapters/system-clock.ts";
import { systemMemory } from "../lint/gate/adapters/system-memory.ts";
import { typescriptModuleReader } from "../lint/gate/adapters/typescript-module-reader.ts";
import { disciplinesCheck } from "../lint/gate/application/disciplines-check.ts";
import type { GateCheck } from "../lint/gate/application/gate-check.ts";
import { sharedBuild } from "../lint/gate/application/shared-build.ts";
import { goldensCheck, type GoldensDependencies } from "../lint/gate/application/goldens-check.ts";
import { lintCheck } from "../lint/gate/application/lint-check.ts";
import { kernelCheck } from "../lint/gate/application/kernel-check.ts";
import { isolationCheck } from "../lint/gate/application/isolation-check.ts";
import { edgeEntriesFile } from "../lint/gate/adapters/edge-entries-file.ts";
import { implementersFile } from "../lint/gate/adapters/implementers-file.ts";
import { monolithCheck } from "../lint/gate/application/monolith-check.ts";
import { ownershipCheck } from "../lint/gate/application/ownership-check.ts";
import { recordsCheck } from "../lint/gate/application/records-check.ts";
import { runGateRequest, type GateReport } from "../lint/gate/application/run-gate.ts";
import { testsCheck, type TestSuite } from "../lint/gate/application/tests-check.ts";
import { typecheckCheck } from "../lint/gate/application/typecheck-check.ts";
import { typecheckProjects } from "../lint/gate/application/typecheck-projects.ts";
import { zonesCheck } from "../lint/gate/application/zones-check.ts";
import type { Command } from "../lint/gate/application/ports.ts";
import { GENERATED_GOLDEN_RECORDS } from "../lint/gate/domain/golden-records.ts";
import type { LanePlan } from "../lint/gate/domain/lane-plan.ts";
import { debtFigureOf } from "../lint/gate/domain/zone-rules.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
const BUN = process.execPath;
const DEFAULT_BASE = "origin/rebuild/foundation";

const RULE_INPUTS = [
  "eslint.config.ts",
  "lint/*.ts",
  "src/glossary.json",
  "bun.lock",
  "disciplines.eslint.mjs",
];
const DEFAULT_DISCIPLINE_CORE = "aidlc-discipline-core-main/plugins/discipline-core";
const DISCIPLINE_CORE_PIN = "lint/discipline-core-pin.txt";
const LINT_ROOTS = ["core", "harness", "scripts", "plugins", "src", "lint", "tests"];
const LOOSE_TESTS = [
  "tests/unit/**/*.test.ts", "tests/smoke/**/*.test.ts",
  "tests/integration/**/*.test.ts", "tests/e2e/**/*.test.ts",
];

const workspace = fileWorkspace(ROOT);
const repository = gitRepository(ROOT);
const temp = runTemp(ROOT);
process.on("exit", temp.dispose);

const runner = processRunner(ROOT, temp.path);
const records = ratchetRecords({ repository, workspace, locations: RECORD_LOCATIONS });
const selection = disciplinesFiles(workspace);
const audit = disciplineCore({
  root: ROOT,
  install:
    process.env["AIDLC_DISCIPLINE_CORE"] ?? besideMainCheckout(ROOT, DEFAULT_DISCIPLINE_CORE),
  pin: workspace.read(DISCIPLINE_CORE_PIN)?.trim(),
  runner,
});
const CLEAN_TRIGGERS = [...CLEAN_ZONE.folders.map((folder) => `${folder}/**`), ...CLEAN_ZONE.files];

const harnesses = (): readonly string[] =>
  workspace
    .filesMatching(["harness/*/manifest.ts"])
    .map((path) => path.split("/")[1] ?? "")
    .filter((name) => name !== "");

const goldenLayout: GoldenLayout = {
  root: ROOT,
  outputRoots: ["dist", "dist-release"],
  harnesses,
  storeDirectory: "tests/golden",
};

const bun = (label: string, args: readonly string[]): Command => ({ label, argv: [BUN, ...args] });

const packageBuild = sharedBuild(runner, bun("bun scripts/package.ts", ["scripts/package.ts"]));

const goldens: GoldensDependencies = {
  runner,
  source: goldenSource(goldenLayout),
  store: goldenStore({ layout: goldenLayout, workspace }),
  build: packageBuild,
  install: () => {
    const previous = previousRelease({
      workspace, beside: (location) => besideMainCheckout(ROOT, location),
    });
    if (!previous.ok) {
      return [{
        subject: "install lifecycle goldens", violation: previous.problem, fix: previous.fix,
      }];
    }
    const result = runner.capture(bun("install lifecycle goldens", [
      "lint/gate/install-lifecycle.ts", "--check", "--previous", previous.value,
    ]));
    return result.exitCode === 0 ? [] : [{
      subject: "install lifecycle goldens", violation: result.output,
      fix: "Restore lint/gate/previous-release.json's retained dist and fix lifecycle drift.",
    }];
  },
};

const tsc = (project: string): Command =>
  bun(`tsc -p ${project}`, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", project]);

const SHIPPED_TYPES_PROJECT = "src/tsconfig.shipped-types.json";

const TYPECHECK_PROJECTS = typecheckProjects(
  {
    tsc,
    shippedTypes: bun(`tsc -b ${SHIPPED_TYPES_PROJECT}`, [
      "node_modules/typescript/bin/tsc",
      "-b",
      SHIPPED_TYPES_PROJECT,
    ]),
  },
  packageBuild,
);

const TRANSPILER_CACHE = transpilerCacheFolder(ROOT);

const LEGACY_SPLIT_SECONDS = 60;

const LEGACY_SHARD_SECONDS = 150;

const LEGACY_WORKERS = Math.max(1, Number(process.env["AIDLC_GATE_TEST_WORKERS"]) || 8);

const TEST_SUITES: readonly TestSuite[] = [
  ...sourceSuites(BUN),
  ...legacySuites(
    { bun: BUN, environment: legacyEnvironment(process.env, TRANSPILER_CACHE) },
    {
      workspace,
      workers: LEGACY_WORKERS,
      splitAtOrAbove: LEGACY_SPLIT_SECONDS,
      targetSeconds: LEGACY_SHARD_SECONDS,
    },
  ),
  {
    name: "lint",
    triggers: ["lint/**", "scripts/gate.ts", "eslint.config.ts", "eslint.config.test.ts"],
    tests: ["lint/**/*.test.ts", "eslint.config.test.ts"],
  },
  {
    name: "monolith ratchet",
    triggers: [...MONOLITH_FILES, LIB_DECLARATIONS, "tests/ratchets/**", MONOLITH_TEST],
    tests: [MONOLITH_TEST],
  },
];

const checksFor = (plan: LanePlan): readonly GateCheck[] => [
  ownershipCheck({
    plan,
    repository,
    workspace,
    modules: typescriptModuleReader,
    json: jsonReader,
    sharedRecords: [...records.globs, ...GENERATED_GOLDEN_RECORDS],
  }),
  zonesCheck({ repository, selection, records }),
  recordsCheck({ repository, records, ruleInputs: RULE_INPUTS }),
  lintCheck({
    linter: eslintLinter({ root: ROOT, roots: LINT_ROOTS, extensions: [".ts"] }),
    records,
    ruleInputs: RULE_INPUTS,
    ownerInputs: OWNER_REGISTRY_FILES,
  }),
  disciplinesCheck({ audit, triggers: CLEAN_TRIGGERS }),
  typecheckCheck({ runner, projects: TYPECHECK_PROJECTS }),
  monolithCheck({ records, workspace, modules: typescriptModuleReader, memberTypes: MEMBER_TYPES }),
  kernelCheck({
    workspace,
    modules: typescriptModuleReader,
    record: nameListFile({ workspace, path: "lint/kernel-exports.txt" }),
    sources: ["src/kernel/*.ts"],
  }),
  goldensCheck(goldens),
  isolationCheck({
    workspace,
    modules: typescriptModuleReader,
    record: nameListFile({ workspace, path: "lint/isolation-offenders.txt" }),
    implementers: implementersFile({ workspace, path: "lint/implementers.json" }),
    edges: edgeEntriesFile({ workspace, path: "lint/edge-entries.json" }),
    sources: ["src/**/*.ts"],
  }),
  testsCheck({
    runner,
    workspace,
    suites: TEST_SUITES,
    looseTests: LOOSE_TESTS,
    capabilities: capabilityProbes(temp.path),
    exclusions: environmentExclusions(workspace),
    testCommand: (files) => bun("bun test", ["test", ...files.map((file) => `./${file}`)]),
    build: packageBuild,
    looseCommand: (files) => changedLegacyCommand({
      bun: BUN, environment: legacyEnvironment(process.env, TRANSPILER_CACHE),
    }, files),
    reachOf: (tests) => testReach({ workspace, tests }),
  }),
];

const EXIT_CODES: Readonly<Record<GateReport["verdict"], number>> = {
  green: 0,
  red: 1,
  error: 2,
  busy: 3,
};

type UsageProblem = { readonly problem: string; readonly fix: string };

const usageError = ({ problem, fix }: UsageProblem): number => {
  process.stderr.write(`gate · error: ${problem}\n${fix}\n`);
  process.stdout.write(`${usageSummaryLine({ problem, fix })}\n`);
  return EXIT_CODES.error;
};

const main = async (): Promise<number> => {
  const defaults = { baseRef: process.env["AIDLC_GATE_BASE"] ?? DEFAULT_BASE, waitSeconds: 1800 };
  const request = gateRequestFrom(Bun.argv.slice(2), defaults);
  if (!request.ok) {
    return usageError(request);
  }
  if (request.value.kind === "help") {
    process.stdout.write(`${USAGE}\n`);
    return EXIT_CODES.green;
  }
  const policy = slotPolicyFrom(process.env);
  if (!policy.ok) {
    return usageError(policy);
  }
  const lockDirectory = process.env["AIDLC_GATE_LOCK_DIR"] ?? lockDirectoryBesideMainCheckout(ROOT);
  const lock = directoryLock({
    directory: lockDirectory,
    cwd: process.cwd(),
    onWait: consoleProgress.note,
    policy: policy.value,
    memory: systemMemory,
  });
  const plans = lanesFile({ workspace, path: "lanes.json" });
  const services = {
    plans,
    repository,
    workspace,
    lock,
    clock: systemClock,
    runner,
    goldens,
    checksFor,
    toolchain: audit,
    sweeps: {
      ledger: sweepLedger(lockDirectory),
      tree: () => sweepTree(ROOT, DEFAULT_BASE),
      slots: policy.value.slots,
    },
  };
  const report = await runGateRequest({ ...services, progress: consoleProgress }, request.value);
  const debt = debtFigureOf(records.boundary({ kind: "head" }) ?? {});
  printDebt(debt);
  printProblem(report);
  process.stdout.write(`${summaryLine({ report, debt })}\n`);
  return report.exitCode ?? EXIT_CODES[report.verdict];
};

process.exitCode = await main();
