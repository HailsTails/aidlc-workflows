import { assert, describe, expect, it, type MockInstance, vi } from "vitest";
import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import { runCheck } from "../core/check/run-check.ts";
import { runProject } from "../core/check/run-project.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { createEslintRunner } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createDefaultEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { createWalkerRunner } from "../mechanisms/walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../mechanisms/walker/runner/typescript-parse.ts";
import { type PathCallsOutside, pathCallsOutside } from "./confinement.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });

const WALKER_CONSUMER = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/consumer-proof/walker` });

const ESLINT_CONSUMER = resolvedPath({ path: `${import.meta.dirname}/test-fixtures/consumer-proof/eslint` });

const INSTALLED_SOURCE = String.raw`(?!(?:[^/]*\/)*tests\/)(?!.*\.test\.ts$).*`;

const WALKER_INSTALLED = String.raw`(?:core|rules\/CD-14|mechanisms\/walker\/runner|mechanisms\/walker\/CD-14)\/${INSTALLED_SOURCE}`;

const ESLINT_INSTALLED = String.raw`(?:core|rules\/CD-14|mechanisms\/eslint\/runner|mechanisms\/eslint\/CD-14)\/${INSTALLED_SOURCE}`;

const WALKER_INSTALL_LIST = new RegExp(`^${WALKER_INSTALLED}$`);

const ESLINT_INSTALL_LIST = new RegExp(`^${ESLINT_INSTALLED}$`);

const WALKER_READABLE = new RegExp(String.raw`^(?:${WALKER_INSTALLED}|tests\/test-fixtures\/consumer-proof\/walker\/.*)$`);

const ESLINT_READABLE = new RegExp(String.raw`^(?:${ESLINT_INSTALLED}|tests\/test-fixtures\/consumer-proof\/eslint\/.*)$`);

const NO_HARNESS_SEGMENT = /^(?!(?:.*\/)?\.(?:claude|kiro|codex|cursor|aidlc|opencode|github|copilot)(?:\/|$)).*$/;

const installCallsOutside = (request: {
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => pathCallsOutside({ path, root: INSTALL_ROOT, calls: request.calls, paths: request.paths });

const EVERY_CALL_WITHIN: PathCallsOutside = { called: "at least once", outside: [] };

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
    [resolvedPath({ path: `${INSTALL_ROOT}/mechanisms/walker/runner/runner.ts` })]: {
      runner: createWalkerRunner({ fileText, modules: pieceModules, path, parse: createDefaultParsePort({}) }),
    },
    [resolvedPath({ path: `${INSTALL_ROOT}/mechanisms/eslint/runner/runner.ts` })]: {
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

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
});

const checkOf = (request: {
  readonly repo: AbsolutePath;
  readonly tracked: readonly RepoPath[];
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

const CLEAN_TRACKED: readonly RepoPath[] = [repoPathSchema.parse("disciplines.json"), repoPathSchema.parse("src/plain.ts")];

const CLASS_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/kept.ts"),
];

const ESLINT_CLEAN_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("disciplines.eslint.mjs"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("src/plain.ts"),
];

const ESLINT_CLASS_TRACKED: readonly RepoPath[] = [
  repoPathSchema.parse("disciplines.json"),
  repoPathSchema.parse("disciplines.eslint.mjs"),
  repoPathSchema.parse("eslint.config.mjs"),
  repoPathSchema.parse("src/plain.ts"),
  repoPathSchema.parse("src/kept.ts"),
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
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment", async () => {
    const ports = observedPorts();
    await checkOf({ repo: WALKER_CONSUMER, tracked: CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
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
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: ESLINT_CONSUMER, ports });
    await checkOf({ repo: ESLINT_CONSUMER, tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
  });
});
