import { fileURLToPath } from "node:url";
import { CONTEXTS, MONOLITH_FILES } from "../lint/context-map.ts";
import { CLEAN_ZONE } from "../lint/zones.ts";
import { gateRequestFrom, USAGE } from "../lint/gate/adapters/cli-arguments.ts";
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
import { gitRepository } from "../lint/gate/adapters/git-repository.ts";
import {
  goldenSource,
  goldenStore,
  type GoldenLayout,
} from "../lint/gate/adapters/golden-files.ts";
import { jsonReader } from "../lint/gate/adapters/json-reader.ts";
import { lanesFile } from "../lint/gate/adapters/lanes-file.ts";
import { nameListFile } from "../lint/gate/adapters/name-list-file.ts";
import { processRunner } from "../lint/gate/adapters/process-runner.ts";
import { ratchetRecords } from "../lint/gate/adapters/ratchet-records.ts";
import {
  LIB_DECLARATIONS,
  MONOLITH_TEST,
  RECORD_LOCATIONS,
} from "../lint/gate/adapters/record-locations.ts";
import { typescriptModuleReader } from "../lint/gate/adapters/typescript-module-reader.ts";
import { disciplinesCheck } from "../lint/gate/application/disciplines-check.ts";
import type { GateCheck } from "../lint/gate/application/gate-check.ts";
import { goldensCheck, type GoldensDependencies } from "../lint/gate/application/goldens-check.ts";
import { lintCheck } from "../lint/gate/application/lint-check.ts";
import { kernelCheck } from "../lint/gate/application/kernel-check.ts";
import { monolithCheck } from "../lint/gate/application/monolith-check.ts";
import { ownershipCheck } from "../lint/gate/application/ownership-check.ts";
import { recordsCheck } from "../lint/gate/application/records-check.ts";
import { runGateRequest, type GateReport } from "../lint/gate/application/run-gate.ts";
import { testsCheck, type TestSuite } from "../lint/gate/application/tests-check.ts";
import { typecheckCheck, type TypecheckProject } from "../lint/gate/application/typecheck-check.ts";
import { zonesCheck } from "../lint/gate/application/zones-check.ts";
import type { Command } from "../lint/gate/application/ports.ts";
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
const LOOSE_TESTS = ["tests/unit/**/*.test.ts", "tests/smoke/**/*.test.ts"];

const workspace = fileWorkspace(ROOT);
const repository = gitRepository(ROOT);
const runner = processRunner(ROOT);
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

const goldens: GoldensDependencies = {
  runner,
  source: goldenSource(goldenLayout),
  store: goldenStore({ layout: goldenLayout, workspace }),
  build: bun("bun scripts/package.ts", ["scripts/package.ts"]),
};

const tsc = (project: string): Command =>
  bun(`tsc -p ${project}`, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", project]);

const TYPECHECK_PROJECTS: readonly TypecheckProject[] = [
  { command: tsc("src/tsconfig.json"), triggers: ["src/**"] },
  {
    command: tsc("lint/tsconfig.json"),
    triggers: ["lint/**", "eslint.config.ts", "scripts/gate.ts", "src/glossary.json"],
  },
];

const TEST_SUITES: readonly TestSuite[] = [
  ...CONTEXTS.map((context) => ({
    name: `src/${context}`,
    triggers: [`src/${context}/**`],
    tests: [`src/${context}/**/*.test.ts`],
  })),
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
    sharedRecords: [...records.globs, "tests/golden/**"],
  }),
  zonesCheck({ repository, selection, records }),
  recordsCheck({ records, ruleInputs: RULE_INPUTS }),
  lintCheck({
    linter: eslintLinter({ root: ROOT, roots: LINT_ROOTS, extensions: [".ts"] }),
    records,
    ruleInputs: RULE_INPUTS,
  }),
  disciplinesCheck({ audit, triggers: CLEAN_TRIGGERS }),
  typecheckCheck({ runner, projects: TYPECHECK_PROJECTS }),
  monolithCheck({ records, workspace, modules: typescriptModuleReader }),
  kernelCheck({
    workspace,
    modules: typescriptModuleReader,
    record: nameListFile({ workspace, path: "lint/kernel-exports.txt" }),
    sources: ["src/kernel/*.ts"],
  }),
  testsCheck({
    runner,
    workspace,
    suites: TEST_SUITES,
    looseTests: LOOSE_TESTS,
    testCommand: (files) => bun("bun test", ["test", ...files.map((file) => `./${file}`)]),
  }),
  goldensCheck(goldens),
];

const EXIT_CODES: Readonly<Record<GateReport["verdict"], number>> = {
  green: 0,
  red: 1,
  error: 2,
  busy: 3,
};

const lock = directoryLock({
  directory: process.env["AIDLC_GATE_LOCK_DIR"] ?? lockDirectoryBesideMainCheckout(ROOT),
  cwd: ROOT,
  onWait: consoleProgress.note,
});

const main = async (): Promise<number> => {
  const defaults = { baseRef: process.env["AIDLC_GATE_BASE"] ?? DEFAULT_BASE, waitSeconds: 1800 };
  const request = gateRequestFrom(Bun.argv.slice(2), defaults);
  if (!request.ok) {
    process.stderr.write(`gate · error: ${request.problem}\n${request.fix}\n`);
    process.stdout.write(`${usageSummaryLine({ problem: request.problem, fix: request.fix })}\n`);
    return EXIT_CODES.error;
  }
  if (request.value.kind === "help") {
    process.stdout.write(`${USAGE}\n`);
    return EXIT_CODES.green;
  }
  const plans = lanesFile({ workspace, path: "lanes.json" });
  const services = {
    plans,
    repository,
    workspace,
    lock,
    runner,
    goldens,
    checksFor,
    toolchain: audit,
  };
  const report = await runGateRequest({ ...services, progress: consoleProgress }, request.value);
  const debt = debtFigureOf(records.boundary({ kind: "head" }) ?? {});
  printDebt(debt);
  printProblem(report);
  process.stdout.write(`${summaryLine({ report, debt })}\n`);
  return report.exitCode ?? EXIT_CODES[report.verdict];
};

process.exitCode = await main();
