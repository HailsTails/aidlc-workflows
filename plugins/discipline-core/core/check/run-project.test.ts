import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { SelectionRepository } from "../consumer-selection/consumer-selection.ts";
import type { SelectionReading } from "../consumer-selection/selection.ts";
import type { ExceptionReading, ExceptionRecord, ExceptionRepository } from "../exception-records/exception-records.ts";
import type { LoadedRunner, RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { type ProjectRequest, runProject } from "./run-project.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const RUNNER_PATH = "/install/mechanisms/walker/runner/runner.ts";
const LINT_RUNNER_PATH = "/install/mechanisms/lint/runner/runner.ts";
const CLASS = clauseAddressSchema.parse("CD-14#class-syntax");
const ABSTRACT = clauseAddressSchema.parse("CD-14#abstract-syntax");
const WALKER = mechanismIdSchema.parse("walker");
const LINT = mechanismIdSchema.parse("lint");
const CLASS_CLAUSE: RunnerClause = {
  address: CLASS,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};
const ABSTRACT_CLAUSE: RunnerClause = {
  ...CLASS_CLAUSE,
  address: ABSTRACT,
  anchor: { kind: "keyword", keyword: "abstract" },
  pieceRoot: "/install/mechanisms/lint/CD-14",
  settings: { module: "abstract-syntax.ts" },
};
const CLASS_READING: SelectionReading = {
  selection: { selected: [{ address: CLASS, mechanism: WALKER }], uncovered: [] },
  bindings: [{ mechanism: WALKER, clause: CLASS_CLAUSE }],
};
const MIXED_READING: SelectionReading = {
  selection: {
    selected: [{ address: CLASS, mechanism: WALKER }, { address: ABSTRACT, mechanism: LINT }],
    uncovered: [],
  },
  bindings: [{ mechanism: WALKER, clause: CLASS_CLAUSE }, { mechanism: LINT, clause: ABSTRACT_CLAUSE }],
};
const WALKER_RECORD: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS,
  mechanism: WALKER,
  file: repoPathSchema.parse("src/walker.ts"),
  reason: "walker location",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation",
  },
};
const LINT_RECORD: ExceptionRecord = {
  ...WALKER_RECORD, clause: ABSTRACT, mechanism: LINT, file: repoPathSchema.parse("src/lint.ts"), reason: "lint location",
};
const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/install","mechanisms","walker","runner","runner.ts"]': RUNNER_PATH,
  '["/install","mechanisms","lint","runner","runner.ts"]': LINT_RUNNER_PATH,
};
const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};
const selectionsReading = (reading: SelectionReading): SelectionRepository => ({
  read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: reading }),
});
const exceptionsReading = (reading: ExceptionReading): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: reading }),
});
const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
});
const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});
const modulesByPath = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});
const GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
};
const projectRequest = (overrides: Partial<ProjectRequest>): ProjectRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  baseRevision: undefined,
  selections: selectionsReading(CLASS_READING),
  exceptions: exceptionsReading({ records: [], invalid: [] }),
  modules: modulesLoading({ runner: standaloneRunner() }),
  path: TABLE_PATH,
  git: GIT,
  ...overrides,
});
const embeddedRunner = () => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({
    outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" },
  }),
});

describe("runProject", () => {
  it("returns no projection writes with a standalone runner and runs no detector or conformance", async () => {
    const runner = standaloneRunner();
    await expect(runProject(projectRequest({ modules: modulesLoading({ runner }) }))).resolves.toEqual({ outcome: "ok", value: [] });
    expect(runner.run).not.toHaveBeenCalled();
    expect(runner.conform).not.toHaveBeenCalled();
  });

  it("loads the install's mechanism runner once", async () => {
    const modules = modulesLoading({ runner: standaloneRunner() });
    await expect(runProject(projectRequest({ modules }))).resolves.toEqual({ outcome: "ok", value: [] });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: RUNNER_PATH });
  });

  it("does not fail the load for a repository's invalid indexed record", async () => {
    await expect(runProject(projectRequest({
      exceptions: exceptionsReading({
        records: [], invalid: [{ index: 3, problem: { kind: "clause-not-selected", clause: ABSTRACT } }],
      }),
    }))).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("forwards a selection repository refusal", async () => {
    const selections: SelectionRepository = {
      read: vi.fn<SelectionRepository["read"]>().mockReturnValue({
        outcome: "failed", error: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "invalid document" },
      }),
    };
    await expect(runProject(projectRequest({ selections }))).resolves.toEqual({
      outcome: "failed", error: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "invalid document" },
    });
  });

  it("forwards an exception repository refusal", async () => {
    const exceptions: ExceptionRepository = {
      read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({
        outcome: "failed", error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json", detail: "invalid document" },
      }),
    };
    await expect(runProject(projectRequest({ exceptions }))).resolves.toEqual({
      outcome: "failed", error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json", detail: "invalid document" },
    });
  });

  it("refuses a runner with an unknown exception path", async () => {
    await expect(runProject(projectRequest({
      modules: modulesLoading({ runner: { ...standaloneRunner(), exceptionPath: "unknown-path" } }),
    }))).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: WALKER } });
  });

  it("returns the embedded projection write without running its detector", async () => {
    const runner = embeddedRunner();
    await expect(runProject(projectRequest({ modules: modulesLoading({ runner }) }))).resolves.toEqual({
      outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }],
    });
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("reads the full durable selection and projects only the mechanism's canonical records", async () => {
    const selections = selectionsReading(MIXED_READING);
    const exceptions = exceptionsReading({ records: [WALKER_RECORD, LINT_RECORD], invalid: [] });
    const runner = embeddedRunner();
    await expect(runProject(projectRequest({
      selections, exceptions,
      modules: modulesByPath({ [RUNNER_PATH]: { runner }, [LINT_RUNNER_PATH]: { runner: standaloneRunner() } }),
    }))).resolves.toEqual({ outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] });
    expect(exceptions.read).toHaveBeenCalledExactlyOnceWith({ selection: MIXED_READING.selection });
    expect(runner.project).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, clauses: [CLASS_CLAUSE], records: [WALKER_RECORD],
    });
  });
});
