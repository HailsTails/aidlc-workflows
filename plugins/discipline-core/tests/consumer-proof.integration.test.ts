import { describe, expect, it, type MockInstance, vi } from "vitest";
import { z } from "zod";
import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import { runCheck } from "../core/check/run-check.ts";
import { runProject } from "../core/check/run-project.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../core/values/absolute-path.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import { createEslintRunner } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createDefaultEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { createWalkerRunner } from "../mechanisms/walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../mechanisms/walker/runner/typescript-parse.ts";

const path = createDefaultPathPort({});

const INSTALL_ROOT = absolutePathSchema.parse(path.resolve({ path: `${import.meta.dirname}/..` }));

const WALKER_CONSUMER = absolutePathSchema.parse(`${INSTALL_ROOT}/tests/test-fixtures/consumer-proof/walker`);

const ESLINT_CONSUMER = absolutePathSchema.parse(`${INSTALL_ROOT}/tests/test-fixtures/consumer-proof/eslint`);

const INSTALLED_SOURCE = z.string().regex(/^(?!(?:[^/]*\/)*tests\/)(?!.*\.test\.ts$).*$/);

const CORE_PATHS = z.templateLiteral([`${INSTALL_ROOT}/core/`, INSTALLED_SOURCE]);

const CD14_RULE_PATHS = z.templateLiteral([`${INSTALL_ROOT}/rules/CD-14/`, INSTALLED_SOURCE]);

const WALKER_INSTALL_LIST = z.union([
  CORE_PATHS,
  CD14_RULE_PATHS,
  z.templateLiteral([`${INSTALL_ROOT}/mechanisms/walker/runner/`, INSTALLED_SOURCE]),
  z.templateLiteral([`${INSTALL_ROOT}/mechanisms/walker/CD-14/`, INSTALLED_SOURCE]),
]);

const ESLINT_INSTALL_LIST = z.union([
  CORE_PATHS,
  CD14_RULE_PATHS,
  z.templateLiteral([`${INSTALL_ROOT}/mechanisms/eslint/runner/`, INSTALLED_SOURCE]),
  z.templateLiteral([`${INSTALL_ROOT}/mechanisms/eslint/CD-14/`, INSTALLED_SOURCE]),
]);

const WALKER_READABLE = z.union([WALKER_INSTALL_LIST, z.templateLiteral([`${WALKER_CONSUMER}/`, z.string()])]);

const ESLINT_READABLE = z.union([ESLINT_INSTALL_LIST, z.templateLiteral([`${ESLINT_CONSUMER}/`, z.string()])]);

const NO_HARNESS_SEGMENT = z.string().regex(/^(?!.*\/\.(?:claude|codex|cursor|kiro|aidlc)\/)/);

const NODE_22_18_OR_LATER = z
  .string()
  .regex(/^(?:22\.(?:1[89]|[2-9]\d|[1-9]\d{2,})|2[3-9]\.\d+|[3-9]\d\.\d+|[1-9]\d{2,}\.\d+)\.\d+$/);

const NODE_REQUIREMENT = "discipline core needs Node 22.18.0 or later";

const pathCallsWithin = (request: { readonly paths: z.ZodType<string> }) =>
  expect.schemaMatching(z.array(z.tuple([z.object({ path: request.paths })])).min(1));

type ObservedPorts = {
  readonly fileText: FileTextPort;
  readonly runnerModules: ModuleLoaderPort;
  readonly reads: MockInstance<FileTextPort["read"]>;
  readonly probes: MockInstance<FileTextPort["exists"]>;
  readonly pieceLoads: MockInstance<ModuleLoaderPort["load"]>;
  readonly runnerLoads: MockInstance<ModuleLoaderPort["load"]>;
};

const observedPorts = (): ObservedPorts => {
  const realFileText = createDefaultFileTextPort({});
  const fileText: FileTextPort = {
    read: realFileText.read,
    exists: realFileText.exists,
    write: vi.fn<FileTextPort["write"]>(),
  };
  const pieceModules: ModuleLoaderPort = { load: createDefaultModuleLoaderPort({}).load };
  const runners: Readonly<Record<string, unknown>> = {
    [`${INSTALL_ROOT}/mechanisms/walker/runner/runner.ts`]: {
      runner: createWalkerRunner({ fileText, modules: pieceModules, path, parse: createDefaultParsePort({}) }),
    },
    [`${INSTALL_ROOT}/mechanisms/eslint/runner/runner.ts`]: {
      runner: createEslintRunner({ fileText, modules: pieceModules, path, eslint: createDefaultEslintPort({}) }),
    },
  };
  const runnerModules: ModuleLoaderPort = {
    load: ({ path: runnerPath }) => Promise.resolve({ outcome: "ok", value: runners[runnerPath] }),
  };
  return {
    fileText,
    runnerModules,
    reads: vi.spyOn(fileText, "read"),
    probes: vi.spyOn(fileText, "exists"),
    pieceLoads: vi.spyOn(pieceModules, "load"),
    runnerLoads: vi.spyOn(runnerModules, "load"),
  };
};

const gitTracking = (request: { readonly tracked: readonly string[] }): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: z.array(repoPathSchema).parse(request.tracked) }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
});

const checkOf = (request: {
  readonly repo: AbsolutePath;
  readonly tracked: readonly string[];
  readonly ports: ObservedPorts;
}) =>
  runCheck({
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    baseRevision: undefined,
    fileText: request.ports.fileText,
    modules: request.ports.runnerModules,
    path,
    git: gitTracking({ tracked: request.tracked }),
  });

const projectOf = (request: { readonly repo: AbsolutePath; readonly ports: ObservedPorts }) =>
  runProject({
    repoRoot: request.repo,
    installRoot: INSTALL_ROOT,
    fileText: request.ports.fileText,
    modules: request.ports.runnerModules,
    path,
    git: gitTracking({ tracked: [] }),
  });

const CLEAN_TRACKED = ["disciplines.json", "src/plain.ts"];

const CLASS_TRACKED = ["disciplines.json", "src/plain.ts", "src/kept.ts"];

const ESLINT_CLEAN_TRACKED = ["disciplines.json", "disciplines.eslint.mjs", "eslint.config.mjs", "src/plain.ts"];

const ESLINT_CLASS_TRACKED = [
  "disciplines.json",
  "disciplines.eslint.mjs",
  "eslint.config.mjs",
  "src/plain.ts",
  "src/kept.ts",
];

const classFinding = (request: { readonly mechanism: string }) => ({
  clause: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
  file: "src/kept.ts",
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
  mechanism: request.mechanism,
});

const CLEAN_REPORT = {
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
};

describe("a consumer with no harness directory selecting CD-14 through the walker, run against the install", () => {
  it("passes when its tracked files hold no class, exiting 0", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: WALKER_CONSUMER, tracked: CLEAN_TRACKED, ports });
    expect(checked).toEqual({ outcome: "ok", value: CLEAN_REPORT });
    expect(checkCommandOutcome({ result: checked }).code).toBe(0);
  });

  it("fails when a tracked file holds a class, exiting 1 with the class as a walker finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: WALKER_CONSUMER, tracked: CLASS_TRACKED, ports });
    expect(checked).toEqual({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [classFinding({ mechanism: "walker" })] },
    });
    expect(checkCommandOutcome({ result: checked }).code).toBe(1);
  });

  it("reads, probes and loads only paths in the walker's install path list or the consumer repo", async () => {
    const ports = observedPorts();
    await checkOf({ repo: WALKER_CONSUMER, tracked: CLASS_TRACKED, ports });
    expect(ports.reads.mock.calls).toEqual(pathCallsWithin({ paths: WALKER_READABLE }));
    expect(ports.probes.mock.calls).toEqual(pathCallsWithin({ paths: WALKER_READABLE }));
    expect(ports.pieceLoads.mock.calls).toEqual(pathCallsWithin({ paths: WALKER_INSTALL_LIST }));
    expect(ports.runnerLoads.mock.calls).toEqual(pathCallsWithin({ paths: WALKER_INSTALL_LIST }));
  });

  it("reads, probes and loads no path carrying a harness segment", async () => {
    const ports = observedPorts();
    await checkOf({ repo: WALKER_CONSUMER, tracked: CLASS_TRACKED, ports });
    expect(ports.reads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.probes.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.pieceLoads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.runnerLoads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
  });
});

describe("a consumer with no harness directory selecting CD-14 through ESLint, run against the install", () => {
  it("projects the checked-in projection unchanged and writes nothing", async () => {
    const ports = observedPorts();
    await expect(projectOf({ repo: ESLINT_CONSUMER, ports })).resolves.toEqual({
      outcome: "ok",
      value: [{ path: "disciplines.eslint.mjs", effect: "unchanged" }],
    });
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });

  it("passes when its tracked files hold no class, exiting 0", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLEAN_TRACKED, ports });
    expect(checked).toEqual({ outcome: "ok", value: CLEAN_REPORT });
    expect(checkCommandOutcome({ result: checked }).code).toBe(0);
  });

  it("fails when a tracked file holds a class, exiting 1 with the class as an ESLint finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(checked).toEqual({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [classFinding({ mechanism: "eslint" })] },
    });
    expect(checkCommandOutcome({ result: checked }).code).toBe(1);
  });

  it("reads, probes and loads only paths in the ESLint install path list or the consumer repo, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(ports.reads.mock.calls).toEqual(pathCallsWithin({ paths: ESLINT_READABLE }));
    expect(ports.probes.mock.calls).toEqual(pathCallsWithin({ paths: ESLINT_READABLE }));
    expect(ports.pieceLoads.mock.calls).toEqual(pathCallsWithin({ paths: ESLINT_INSTALL_LIST }));
    expect(ports.runnerLoads.mock.calls).toEqual(pathCallsWithin({ paths: ESLINT_INSTALL_LIST }));
  });

  it("reads, probes and loads no path carrying a harness segment, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(ports.reads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.probes.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.pieceLoads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
    expect(ports.runnerLoads.mock.calls).toEqual(pathCallsWithin({ paths: NO_HARNESS_SEGMENT }));
  });
});

describe("the Node running the consumer proof", () => {
  it("is Node 22.18.0 or later, which runs the install's .ts source with no build step", () => {
    expect(process.versions.node, NODE_REQUIREMENT).toEqual(expect.schemaMatching(NODE_22_18_OR_LATER));
  });
});
