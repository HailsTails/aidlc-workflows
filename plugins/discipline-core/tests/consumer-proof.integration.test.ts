import { afterAll, assert, beforeAll, describe, expect, it, type MockInstance, vi } from "vitest";
import { checkCommandOutcome } from "../core/check/command-outcome.ts";
import { createSelectionRepository } from "../core/consumer-selection/consumer-selection.ts";
import { createExceptionRepository } from "../core/exception-records/exception-records.ts";
import { runCheck } from "../core/check/run-check.ts";
import { runProject } from "../core/check/run-project.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { DirectoryPort } from "../core/platform-ports/file-system-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { createEslintRunner } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createDefaultEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { createWalkerRunner } from "../mechanisms/walker/runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../mechanisms/walker/runner/typescript-parse.ts";
import { createDefaultScratchFilesPort } from "../scripts/install-proof-ports.ts";
import { type PathCallsOutside, pathCallsOutside } from "./confinement.ts";

const path = createDefaultPathPort({});

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const SOURCE_INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/..` });

const PROVIDER_FILES = [
  "rules/CD-14/discipline.json",
  "mechanisms/eslint/CD-14/piece.json",
  "mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
  "mechanisms/eslint/runner/runner.ts",
  "mechanisms/walker/CD-14/piece.json",
  "mechanisms/walker/CD-14/class-syntax.ts",
  "mechanisms/walker/runner/runner.ts",
];
const scratch = createDefaultScratchFilesPort({});
const fixtureText = createDefaultFileTextPort({});
let fixtureEnclosure: AbsolutePath | undefined;

const fixtureRoot = (): AbsolutePath => {
  assert(fixtureEnclosure !== undefined, "the physical fixture enclosure was allocated");
  return fixtureEnclosure;
};

const fixtureInstallRoot = (): AbsolutePath =>
  resolvedPath({ path: path.join({ segments: [fixtureRoot(), "provider"] }) });

const fixtureConsumer = (request: { readonly name: string }): AbsolutePath =>
  resolvedPath({ path: path.join({ segments: [fixtureRoot(), "consumers", request.name] }) });

const copyProviderFile = (file: string): void => {
  const copied = scratch.copyTree({
    from: path.join({ segments: [SOURCE_INSTALL_ROOT, file] }),
    to: path.join({ segments: [fixtureInstallRoot(), file] }),
    disposition: () => "kept",
  });
  assert(copied.outcome === "ok", JSON.stringify(copied));
};

const rewriteCopiedImport = (request: { readonly file: string; readonly previous: string }): void => {
  const file = path.join({ segments: [fixtureRoot(), "consumers", request.file] });
  const read = fixtureText.read({ path: file });
  assert(read.outcome === "ok", JSON.stringify(read));
  assert(read.value.includes(request.previous), "the copied fixture retains its original provider import");
  const written = fixtureText.write({
    path: file,
    text: read.value.replace(request.previous, '"../../provider/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts"'),
  });
  assert(written.outcome === "ok", JSON.stringify(written));
};

beforeAll(() => {
  const allocated = scratch.createTemporaryDirectory({ prefix: "discipline-core-consumer-fixtures-" });
  assert(allocated.outcome === "ok", JSON.stringify(allocated));
  fixtureEnclosure = resolvedPath({ path: allocated.value });
  const copied = scratch.copyTree({
    from: path.join({ segments: [SOURCE_INSTALL_ROOT, "tests", "test-fixtures", "consumer-proof"] }),
    to: path.join({ segments: [fixtureRoot(), "consumers"] }),
    disposition: () => "kept",
  });
  assert(copied.outcome === "ok", JSON.stringify(copied));
  PROVIDER_FILES.forEach(copyProviderFile);
  rewriteCopiedImport({
    file: "eslint/disciplines.eslint.mjs",
    previous: '"../../../../mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts"',
  });
});

afterAll(() => {
  const removed = scratch.removeTree({ path: fixtureRoot() });
  assert(removed.outcome === "ok", JSON.stringify(removed));
});

const walkerDirectories = (): ReadonlyMap<string, ReturnType<DirectoryPort["list"]>> => new Map([
  [fixtureConsumer({ name: "walker" }), { outcome: "ok", value: [{ name: "disciplines.json", kind: "file" }, { name: "src", kind: "directory" }] }],
  [resolvedPath({ path: `${fixtureConsumer({ name: "walker" })}/src` }), { outcome: "ok", value: [{ name: "kept.ts", kind: "file" }, { name: "plain.ts", kind: "file" }] }],
]);

const INSTALLED_SOURCE = String.raw`(?!(?:[^/]*\/)*tests\/)(?!.*\.test\.ts$).*`;

const WALKER_INSTALLED = String.raw`provider\/(?:core|rules\/CD-14|mechanisms\/walker\/runner|mechanisms\/walker\/CD-14)\/${INSTALLED_SOURCE}`;

const ESLINT_INSTALLED = String.raw`provider\/(?:core|rules\/CD-14|mechanisms\/eslint\/runner|mechanisms\/eslint\/CD-14)\/${INSTALLED_SOURCE}`;

const WALKER_INSTALL_LIST = new RegExp(`^${WALKER_INSTALLED}$`);

const ESLINT_INSTALL_LIST = new RegExp(`^${ESLINT_INSTALLED}$`);

const WALKER_READABLE = new RegExp(String.raw`^(?:${WALKER_INSTALLED}|consumers\/walker\/.*)$`);

const ESLINT_READABLE = new RegExp(String.raw`^(?:${ESLINT_INSTALLED}|consumers\/eslint\/.*)$`);

const NO_HARNESS_SEGMENT = /^(?!(?:.*\/)?\.(?:claude|kiro|codex|cursor|aidlc|opencode|github|copilot)(?:\/|$)).*$/;

const installCallsOutside = (request: {
  readonly calls: readonly (readonly [{ readonly path: string }])[];
  readonly paths: RegExp;
}): PathCallsOutside => pathCallsOutside({ path, root: fixtureRoot(), calls: request.calls, paths: request.paths });

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
  const directories = walkerDirectories();
  const runners: Readonly<Record<string, unknown>> = {
    [resolvedPath({ path: `${fixtureInstallRoot()}/mechanisms/walker/runner/runner.ts` })]: {
      runner: createWalkerRunner({ directory: { list: ({ path }) => directories.get(path) ?? assert.fail("unexpected directory") }, fileText, modules: pieceModules, path, parse: createDefaultParsePort({}) }),
    },
    [resolvedPath({ path: `${fixtureInstallRoot()}/mechanisms/eslint/runner/runner.ts` })]: {
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
    installRoot: fixtureInstallRoot(),
    baseRevision: undefined,
    selections: createSelectionRepository({ repoRoot: request.repo, installRoot: fixtureInstallRoot(), fileText: request.ports.fileText, path }),
    exceptions: createExceptionRepository({ repoRoot: request.repo, fileText: request.ports.fileText, path }),
    modules: request.ports.runnerModules,
    path,
    git: gitTracking({ tracked: request.tracked }),
  });

const projectOf = (request: { readonly repo: AbsolutePath; readonly ports: ObservedPorts }) =>
  runProject({
    baseRevision: undefined,
    repoRoot: request.repo,
    installRoot: fixtureInstallRoot(),
    selections: createSelectionRepository({ repoRoot: request.repo, installRoot: fixtureInstallRoot(), fileText: request.ports.fileText, path }),
    exceptions: createExceptionRepository({ repoRoot: request.repo, fileText: request.ports.fileText, path }),
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
  it("finds a class present outside tracked metadata, exiting 1", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: fixtureConsumer({ name: "walker" }), tracked: CLEAN_TRACKED, ports });
    expect(checked).toMatchObject({ outcome: "ok", value: { ...CLEAN_REPORT, findings: [classFinding({ mechanism: "walker" })] } });
    expect(checkCommandOutcome({ result: checked }).code).toBe(1);
  });

  it("fails when a tracked file holds a class, exiting 1 with the class as a walker finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: fixtureConsumer({ name: "walker" }), tracked: CLASS_TRACKED, ports });
    expect(checked).toMatchObject({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [classFinding({ mechanism: "walker" })] },
    });
    expect(checkCommandOutcome({ result: checked }).code).toBe(1);
  });

  it("reads, probes and loads only paths in the walker's install path list or the consumer repo", async () => {
    const ports = observedPorts();
    await checkOf({ repo: fixtureConsumer({ name: "walker" }), tracked: CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: WALKER_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: WALKER_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment", async () => {
    const ports = observedPorts();
    await checkOf({ repo: fixtureConsumer({ name: "walker" }), tracked: CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
  });
});

describe("a consumer with no harness directory selecting CD-14 through ESLint, run against the install", () => {
  it("projects the checked-in projection unchanged and writes nothing", async () => {
    const ports = observedPorts();
    await expect(projectOf({ repo: fixtureConsumer({ name: "eslint" }), ports })).resolves.toEqual({
      outcome: "ok",
      value: [{ path: "disciplines.eslint.mjs", effect: "unchanged" }],
    });
    expect(ports.fileText.write).not.toHaveBeenCalled();
  });

  it("passes when its tracked files hold no class, exiting 0", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: fixtureConsumer({ name: "eslint" }), tracked: ESLINT_CLEAN_TRACKED, ports });
    expect(checked).toMatchObject({ outcome: "ok", value: CLEAN_REPORT });
    expect(checkCommandOutcome({ result: checked }).code).toBe(0);
  });

  it("fails when a tracked file holds a class, exiting 1 with the class as an ESLint finding", async () => {
    const ports = observedPorts();
    const checked = await checkOf({ repo: fixtureConsumer({ name: "eslint" }), tracked: ESLINT_CLASS_TRACKED, ports });
    expect(checked).toMatchObject({
      outcome: "ok",
      value: { ...CLEAN_REPORT, findings: [classFinding({ mechanism: "eslint" })] },
    });
    expect(checkCommandOutcome({ result: checked }).code).toBe(1);
  });

  it("reads, probes and loads only paths in the ESLint install path list or the consumer repo, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: fixtureConsumer({ name: "eslint" }), ports });
    await checkOf({ repo: fixtureConsumer({ name: "eslint" }), tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: ESLINT_READABLE })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: ESLINT_INSTALL_LIST })).toEqual(EVERY_CALL_WITHIN);
  });

  it("reads, probes and loads no path carrying a harness segment, check and project alike", async () => {
    const ports = observedPorts();
    await projectOf({ repo: fixtureConsumer({ name: "eslint" }), ports });
    await checkOf({ repo: fixtureConsumer({ name: "eslint" }), tracked: ESLINT_CLASS_TRACKED, ports });
    expect(installCallsOutside({ calls: ports.reads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.probes.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.pieceLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
    expect(installCallsOutside({ calls: ports.runnerLoads.mock.calls, paths: NO_HARNESS_SEGMENT })).toEqual(EVERY_CALL_WITHIN);
  });
});
