import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { SelectionRepository } from "../consumer-selection/consumer-selection.ts";
import type { SelectionReading } from "../consumer-selection/selection.ts";
import type { ExceptionReading, ExceptionRecord, ExceptionRepository } from "../exception-records/exception-records.ts";
import type { LoadedRunner, LocationScope, RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { GitFailure, GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { WhyChain } from "../values/why-chain.ts";
import { type CheckRequest, runCheck } from "./run-check.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const RUNNER_PATH = "/install/mechanisms/walker/runner/runner.ts";
const LINT_RUNNER_PATH = "/install/mechanisms/lint/runner/runner.ts";
const UNUSED_RUNNER_PATH = "/install/mechanisms/unused/runner/runner.ts";
const MISSING_RUNNER_PATH = "/install/mechanisms/missing/runner/runner.ts";
const ABSENT_RUNNER_PATH = "/install/mechanisms/absent/runner/runner.ts";
const WALKER = mechanismIdSchema.parse("walker");
const LINT = mechanismIdSchema.parse("lint");
const UNUSED = mechanismIdSchema.parse("unused");
const MISSING = mechanismIdSchema.parse("missing");
const ABSENT = mechanismIdSchema.parse("absent");
const CLASS = clauseAddressSchema.parse("CD-14#class-syntax");
const ABSTRACT = clauseAddressSchema.parse("CD-14#abstract-syntax");
const UNREQUESTED = clauseAddressSchema.parse("CD-15#loops");
const MISSING_NATIVE = clauseAddressSchema.parse("CD-14#missing-native");
const ABSENT_NATIVE = clauseAddressSchema.parse("CD-14#absent-native");
const NAMED_CLASS = clauseAddressSchema.parse("team/CD-14#class-syntax");
const A = repoPathSchema.parse("src/a.ts");
const B = repoPathSchema.parse("src/b.tsx");
const GONE = repoPathSchema.parse("src/gone.ts");
const FACTORY = repoPathSchema.parse("src/factory.ts");

const CLASS_CLAUSE: RunnerClause = {
  address: CLASS,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "class-syntax.ts" },
};
const ABSTRACT_CLAUSE: RunnerClause = {
  address: ABSTRACT,
  anchor: { kind: "keyword", keyword: "abstract" },
  pieceRoot: "/install/mechanisms/walker/CD-14",
  settings: { module: "abstract-syntax.ts" },
};
const NAMED_CLAUSE: RunnerClause = {
  ...CLASS_CLAUSE,
  address: NAMED_CLASS,
  pieceRoot: "/repo/rules/team/mechanisms/walker/CD-14",
};
const UNUSED_CLAUSE: RunnerClause = { ...CLASS_CLAUSE, address: UNREQUESTED };
const MISSING_CLAUSE: RunnerClause = { ...CLASS_CLAUSE, address: MISSING_NATIVE };
const ABSENT_CLAUSE: RunnerClause = { ...CLASS_CLAUSE, address: ABSENT_NATIVE };

const CLASS_READING: SelectionReading = {
  selection: { selected: [{ address: CLASS, mechanism: WALKER }], uncovered: [] },
  bindings: [{ mechanism: WALKER, clause: CLASS_CLAUSE }],
};
const TWO_CLAUSE_READING: SelectionReading = {
  selection: {
    selected: [{ address: CLASS, mechanism: WALKER }, { address: ABSTRACT, mechanism: WALKER }],
    uncovered: [],
  },
  bindings: [{ mechanism: WALKER, clause: CLASS_CLAUSE }, { mechanism: WALKER, clause: ABSTRACT_CLAUSE }],
};
const MIXED_READING: SelectionReading = {
  selection: {
    selected: [{ address: CLASS, mechanism: WALKER }, { address: ABSTRACT, mechanism: LINT }],
    uncovered: [],
  },
  bindings: [{ mechanism: WALKER, clause: CLASS_CLAUSE }, { mechanism: LINT, clause: ABSTRACT_CLAUSE }],
};
const SCOPE_READING: SelectionReading = {
  selection: {
    selected: [
      { address: CLASS, mechanism: WALKER },
      { address: ABSTRACT, mechanism: LINT },
      { address: UNREQUESTED, mechanism: UNUSED },
    ],
    uncovered: [],
  },
  bindings: [
    { mechanism: WALKER, clause: CLASS_CLAUSE },
    { mechanism: LINT, clause: ABSTRACT_CLAUSE },
    { mechanism: UNUSED, clause: UNUSED_CLAUSE },
  ],
};
const COVERAGE_READING: SelectionReading = {
  selection: {
    selected: [
      { address: CLASS, mechanism: WALKER },
      { address: ABSTRACT, mechanism: WALKER },
      { address: UNREQUESTED, mechanism: UNUSED },
      { address: MISSING_NATIVE, mechanism: MISSING },
      { address: ABSENT_NATIVE, mechanism: ABSENT },
    ],
    uncovered: [],
  },
  bindings: [
    { mechanism: WALKER, clause: CLASS_CLAUSE },
    { mechanism: WALKER, clause: ABSTRACT_CLAUSE },
    { mechanism: UNUSED, clause: UNUSED_CLAUSE },
    { mechanism: MISSING, clause: MISSING_CLAUSE },
    { mechanism: ABSENT, clause: ABSENT_CLAUSE },
  ],
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/install","mechanisms","walker","runner","runner.ts"]': RUNNER_PATH,
  '["/install","mechanisms","lint","runner","runner.ts"]': LINT_RUNNER_PATH,
  '["/install","mechanisms","unused","runner","runner.ts"]': UNUSED_RUNNER_PATH,
  '["/install","mechanisms","missing","runner","runner.ts"]': MISSING_RUNNER_PATH,
  '["/install","mechanisms","absent","runner","runner.ts"]': ABSENT_RUNNER_PATH,
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
const TRACKED_PATHS: readonly RepoPath[] = [
  repoPathSchema.parse("README.md"),
  repoPathSchema.parse("package.json"),
  A,
  B,
  repoPathSchema.parse("src/c.mts"),
  repoPathSchema.parse("src/d.cts"),
  repoPathSchema.parse("src/e.js"),
  repoPathSchema.parse("src/f.json"),
  GONE,
];
const WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "plugins/rin/tools/rin-harness-why-chain.ts:9",
};
const CHAIN: WhyChain = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "the walker's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};
const LEGACY_DEBT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS,
  mechanism: WALKER,
  file: repoPathSchema.parse("src/legacy.ts"),
  reason: "legacy class awaiting paydown",
  whyChain: CHAIN,
};
const FACTORY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS,
  mechanism: WALKER,
  file: FACTORY,
  reason: "the wrapping factory for the library",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional unit fixture core/check/run-check.test.ts; not historical authorisation",
  },
};
const WALKER_RECORD: ExceptionRecord = { ...FACTORY_LOCATION, file: repoPathSchema.parse("src/walker.ts"), reason: "walker location" };
const LINT_RECORD: ExceptionRecord = { ...FACTORY_LOCATION, clause: ABSTRACT, mechanism: LINT, file: repoPathSchema.parse("src/lint.ts"), reason: "lint location" };
const UNREQUESTED_LOCATION: ExceptionRecord = { ...FACTORY_LOCATION, clause: UNREQUESTED, mechanism: UNUSED };
const HIT_IN_A = { clause: CLASS, file: A, anchor: { line: 3, column: 0 }, snippet: "class A {}" };
const EMPTY_REPORT = {
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
const EMPTY_OBSERVATIONS = { hits: [], evaluated: [{ clause: CLASS, files: [] }] };

const selectionsReading = (reading: SelectionReading): SelectionRepository => ({
  read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: reading }),
});
const exceptionsReading = (reading: ExceptionReading): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: reading }),
});
const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});
const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});
const modulesByPath = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});
const gitReporting = (request: {
  readonly trackedPaths: Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: Result<readonly RepoPath[], GitFailure>;
}): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.trackedPaths),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue(request.changedSince),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
});
const MEASURED_GIT = gitReporting({
  trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
  changedSince: { outcome: "ok", value: [A] },
});
const checkRequest = (overrides: Partial<CheckRequest>): CheckRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  baseRevision: "main",
  selections: selectionsReading(CLASS_READING),
  exceptions: exceptionsReading({ records: [], invalid: [] }),
  modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } }) }),
  path: TABLE_PATH,
  git: MEASURED_GIT,
  ...overrides,
});
const embeddedRunnerReporting = (report: unknown) => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: report }),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({
    outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "unchanged" },
  }),
});

describe("runCheck reports", () => {
  it("is a pass report when the runner flags nothing", async () => {
    await expect(runCheck(checkRequest({}))).resolves.toMatchObject({ outcome: "ok", value: EMPTY_REPORT });
  });

  it("reports the runner's hit as a finding attributed to its mechanism", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: {
        outcome: "ok", value: { hits: [HIT_IN_A], evaluated: [{ clause: CLASS, files: [A] }] },
      } }) }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: { ...EMPTY_REPORT, findings: [{ ...HIT_IN_A, mechanism: WALKER }] },
    });
  });

  it("exempts a finding an authorised location names and credits the location", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [FACTORY_LOCATION], invalid: [] }),
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: {
        outcome: "ok",
        value: { hits: [{ ...HIT_IN_A, file: FACTORY }], evaluated: [{ clause: CLASS, files: [FACTORY] }] },
      } }) }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: {
        ...EMPTY_REPORT,
        exempted: [{ finding: { ...HIT_IN_A, file: FACTORY, mechanism: WALKER }, by: [FACTORY_LOCATION] }],
      },
    });
  });

  it("lists an invalid exception's original index without failing the load", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [], invalid: [{ index: 7, problem: { kind: "clause-not-selected", clause: ABSTRACT } }] }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: { invalidRecords: [{ index: 7, problem: { kind: "clause-not-selected", clause: ABSTRACT } }] },
    });
  });

  it("retains the repository's uncovered mechanical clauses", async () => {
    await expect(runCheck(checkRequest({
      selections: selectionsReading({ ...CLASS_READING, selection: { ...CLASS_READING.selection, uncovered: [ABSTRACT] } }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { ...EMPTY_REPORT, uncovered: [ABSTRACT] } });
  });
});

describe("runCheck forfeiture measurement", () => {
  it("reports forfeiture-unmeasured without a base revision when a file carve-out exists", async () => {
    await expect(runCheck(checkRequest({
      baseRevision: undefined,
      exceptions: exceptionsReading({ records: [LEGACY_DEBT], invalid: [] }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [{ kind: "forfeiture-unmeasured" }] } });
  });

  it("reports forfeiture-unmeasured when Git cannot measure the change set", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [LEGACY_DEBT], invalid: [] }),
      git: gitReporting({
        trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
        changedSince: { outcome: "failed", error: { kind: "git-failed", command: "git diff", detail: "bad revision 'main'" } },
      }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [{ kind: "forfeiture-unmeasured" }] } });
  });

  it("reports nothing unmeasured without a base revision when no file carve-out exists", async () => {
    await expect(runCheck(checkRequest({ baseRevision: undefined }))).resolves.toMatchObject({ outcome: "ok", value: EMPTY_REPORT });
  });

  it("reports nothing unmeasured without a base revision when only an authorised location exists", async () => {
    await expect(runCheck(checkRequest({
      baseRevision: undefined,
      exceptions: exceptionsReading({ records: [FACTORY_LOCATION], invalid: [] }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [] } });
  });

  it("reports nothing unmeasured when the change set is measured", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [LEGACY_DEBT], invalid: [] }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [] } });
  });

  it("forfeits a file carve-out whose file the measured change set touched", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [LEGACY_DEBT], invalid: [] }),
      git: gitReporting({
        trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
        changedSince: { outcome: "ok", value: [repoPathSchema.parse("src/legacy.ts")] },
      }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: { forfeited: [LEGACY_DEBT], stale: [] },
    });
  });
});

describe("runCheck runner dispatch", () => {
  it("loads a mechanism once and forwards all its clauses and complete raw tracked metadata", async () => {
    const selections = selectionsReading(TWO_CLAUSE_READING);
    const exceptions = exceptionsReading({ records: [], invalid: [] });
    const runner = standaloneRunner({ runReturns: {
      outcome: "ok", value: { hits: [], evaluated: [{ clause: CLASS, files: [] }, { clause: ABSTRACT, files: [] }] },
    } });
    const modules = modulesLoading({ runner });
    await runCheck(checkRequest({ selections, exceptions, modules }));
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: RUNNER_PATH });
    expect(runner.run).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, trackedPaths: TRACKED_PATHS,
      clauses: [CLASS_CLAUSE, ABSTRACT_CLAUSE],
    });
    expect(selections.read).toHaveBeenCalledExactlyOnceWith({});
    expect(exceptions.read).toHaveBeenCalledExactlyOnceWith({ selection: TWO_CLAUSE_READING.selection });
  });

  it("retains absent tracked metadata while forfeiting debt on that touched path", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } });
    const goneDebt: ExceptionRecord = { ...LEGACY_DEBT, file: GONE };
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [goneDebt], invalid: [] }),
      modules: modulesLoading({ runner }),
      git: gitReporting({
        trackedPaths: { outcome: "ok", value: [repoPathSchema.parse("README.md"), A, GONE] },
        changedSince: { outcome: "ok", value: [GONE] },
      }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { forfeited: [goneDebt] } });
    expect(runner.run).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, trackedPaths: ["README.md", A, GONE], clauses: [CLASS_CLAUSE],
    });
  });

  it("retains the named rule-set piece root while loading the install's mechanism runner", async () => {
    const runner = standaloneRunner({ runReturns: {
      outcome: "ok", value: { hits: [], evaluated: [{ clause: NAMED_CLASS, files: [] }] },
    } });
    const modules = modulesLoading({ runner });
    const selections = selectionsReading({
      selection: { selected: [{ address: NAMED_CLASS, mechanism: WALKER }], uncovered: [] },
      bindings: [{ mechanism: WALKER, clause: NAMED_CLAUSE }],
    });
    await expect(runCheck(checkRequest({ selections, modules }))).resolves.toMatchObject({ outcome: "ok", value: EMPTY_REPORT });
    expect(runner.run).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, trackedPaths: TRACKED_PATHS, clauses: [NAMED_CLAUSE],
    });
    expect(modules.load).toHaveBeenCalledExactlyOnceWith({ path: RUNNER_PATH });
  });
});

describe("runCheck load failures", () => {
  it("forwards a selection repository failure without reading exceptions or loading runners", async () => {
    const selections: SelectionRepository = {
      read: vi.fn<SelectionRepository["read"]>().mockReturnValue({
        outcome: "failed", error: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
      }),
    };
    const exceptions = exceptionsReading({ records: [], invalid: [] });
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } }) });
    await expect(runCheck(checkRequest({ selections, exceptions, modules }))).resolves.toEqual({
      outcome: "failed", error: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" },
    });
    expect(exceptions.read).not.toHaveBeenCalled();
    expect(modules.load).not.toHaveBeenCalled();
  });

  it("forwards an exception repository failure without loading runners", async () => {
    const exceptions: ExceptionRepository = {
      read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({
        outcome: "failed", error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json", detail: "invalid document" },
      }),
    };
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } }) });
    await expect(runCheck(checkRequest({ exceptions, modules }))).resolves.toEqual({
      outcome: "failed", error: { kind: "file-malformed", path: "/repo/discipline-exceptions.json", detail: "invalid document" },
    });
    expect(modules.load).not.toHaveBeenCalled();
  });

  it("is runner-invalid for an unknown exception path", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: { ...standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } }), exceptionPath: "unknown-path" } }),
    }))).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: WALKER } });
  });

  it("preserves the loader's failure detail", async () => {
    await expect(runCheck(checkRequest({
      modules: { load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
        outcome: "failed", error: { kind: "module-unloadable", path: RUNNER_PATH, detail: "Cannot find package 'typescript'" },
      }) },
    }))).resolves.toEqual({
      outcome: "failed", error: { kind: "runner-invalid", mechanism: WALKER, detail: "Cannot find package 'typescript'" },
    });
  });

  it("is runner-invalid when the module has no runner export", async () => {
    await expect(runCheck(checkRequest({ modules: modulesLoading({ createWalkerRunner: vi.fn() }) }))).resolves.toMatchObject({
      outcome: "failed", error: { kind: "runner-invalid", mechanism: WALKER },
    });
  });

  it("is git-failed when tracked metadata cannot be read", async () => {
    await expect(runCheck(checkRequest({
      git: gitReporting({
        trackedPaths: { outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" } },
        changedSince: { outcome: "ok", value: [] },
      }),
    }))).resolves.toEqual({
      outcome: "failed", error: { kind: "git-failed", detail: "git ls-files: not a git repository" },
    });
  });

  it("preserves the runner's own failure", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: {
        outcome: "failed", error: { kind: "file-unparseable", file: A, detail: "unexpected token" },
      } }) }),
    }))).resolves.toEqual({
      outcome: "failed", error: {
        kind: "runner-failed", mechanism: WALKER, failure: { kind: "file-unparseable", file: A, detail: "unexpected token" },
      },
    });
  });

  it("is runner-failed when the returned value is not a Result", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: [HIT_IN_A] }) }),
    }))).resolves.toMatchObject({
      outcome: "failed", error: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "runner-invalid-output" } },
    });
  });
});

describe("runCheck with an embedded runner", () => {
  it.each(["missing", "not-included"])("retains explicit unmeasurement for a %s projection", async (projection) => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: embeddedRunnerReporting({ hits: [], evaluated: [], nativeExceptions: [], projection }) }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: { ...EMPTY_REPORT, unmeasured: [{ kind: "mechanism-not-run", mechanism: WALKER, projection }] },
    });
  });

  it("retains an out-of-date projection beside its findings", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: embeddedRunnerReporting({
        hits: [HIT_IN_A], evaluated: [{ clause: CLASS, files: [A] }], nativeExceptions: [], projection: "out-of-date",
      }) }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: {
        ...EMPTY_REPORT, findings: [{ ...HIT_IN_A, mechanism: WALKER }],
        projectionProblems: [{ mechanism: WALKER, state: "out-of-date" }],
      },
    });
  });

  it("attributes native exceptions of kinds not written by the projection as unrecorded", async () => {
    await expect(runCheck(checkRequest({
      modules: modulesLoading({ runner: embeddedRunnerReporting({
        hits: [], evaluated: [{ clause: CLASS, files: [A] }],
        nativeExceptions: [{ kind: "ignore", clause: CLASS, file: A }], projection: "current",
      }) }),
    }))).resolves.toMatchObject({
      outcome: "ok", value: {
        ...EMPTY_REPORT, unrecorded: [{ kind: "ignore", clause: CLASS, file: A, mechanism: WALKER }],
      },
    });
  });

  it("records a projected config override using the complete canonical location", async () => {
    await expect(runCheck(checkRequest({
      exceptions: exceptionsReading({ records: [FACTORY_LOCATION], invalid: [] }),
      modules: modulesLoading({ runner: embeddedRunnerReporting({
        hits: [], evaluated: [{ clause: CLASS, files: [FACTORY] }],
        nativeExceptions: [{ kind: "config-override", clause: CLASS, file: FACTORY }], projection: "current",
      }) }),
    }))).resolves.toMatchObject({ outcome: "ok", value: { ...EMPTY_REPORT, stale: [FACTORY_LOCATION] } });
  });

  it("passes embedded execution only the complete records of its mechanism", async () => {
    const runner = embeddedRunnerReporting({
      hits: [], evaluated: [{ clause: CLASS, files: [] }], nativeExceptions: [], projection: "current",
    });
    await expect(runCheck(checkRequest({
      selections: selectionsReading(MIXED_READING),
      exceptions: exceptionsReading({ records: [WALKER_RECORD, LINT_RECORD], invalid: [] }),
      modules: modulesByPath({
        [RUNNER_PATH]: { runner },
        [LINT_RUNNER_PATH]: { runner: standaloneRunner({ runReturns: {
          outcome: "ok", value: { hits: [], evaluated: [{ clause: ABSTRACT, files: [] }] },
        } }) },
      }),
    }))).resolves.toMatchObject({ outcome: "ok" });
    expect(runner.run).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, trackedPaths: TRACKED_PATHS,
      clauses: [CLASS_CLAUSE], records: [WALKER_RECORD],
    });
  });
});

describe("runCheck scoped coverage", () => {
  it("narrows bindings in durable order after full exception reading and preserves scope, metadata and unexamined records", async () => {
    const selections = selectionsReading(SCOPE_READING);
    const exceptions = exceptionsReading({
      records: [FACTORY_LOCATION, UNREQUESTED_LOCATION],
      invalid: [{ index: 9, problem: { kind: "duplicate", ofIndex: 2 } }],
    });
    const includes = vi.fn<LocationScope>().mockReturnValue("excluded");
    const firstRun = vi.fn<LoadedRunner["run"]>().mockResolvedValue({
      outcome: "ok", value: { hits: [], evaluated: [{ clause: CLASS, files: [] }] },
    });
    const secondRun = vi.fn<LoadedRunner["run"]>().mockResolvedValue({
      outcome: "ok", value: { hits: [], evaluated: [{ clause: ABSTRACT, files: [] }] },
    });
    const unusedRun = vi.fn<LoadedRunner["run"]>().mockResolvedValue({
      outcome: "ok", value: { hits: [], evaluated: [{ clause: UNREQUESTED, files: [] }] },
    });
    const modules = modulesByPath({
      [RUNNER_PATH]: { runner: { ...standaloneRunner({ runReturns: undefined }), run: firstRun } },
      [LINT_RUNNER_PATH]: { runner: { ...standaloneRunner({ runReturns: undefined }), run: secondRun } },
      [UNUSED_RUNNER_PATH]: { runner: { ...standaloneRunner({ runReturns: undefined }), run: unusedRun } },
    });
    const loads = vi.spyOn(modules, "load");

    await expect(runCheck(checkRequest({
      selections, exceptions, modules, scope: { clauses: [ABSTRACT, CLASS], includes },
    }))).resolves.toMatchObject({
      outcome: "ok",
      value: { ...EMPTY_REPORT, invalidRecords: [{ index: 9, problem: { kind: "duplicate", ofIndex: 2 } }] },
    });
    expect(selections.read).toHaveBeenCalledExactlyOnceWith({});
    expect(exceptions.read).toHaveBeenCalledExactlyOnceWith({ selection: SCOPE_READING.selection });
    expect(loads.mock.calls).toEqual([[{ path: RUNNER_PATH }], [{ path: LINT_RUNNER_PATH }]]);
    expect(firstRun).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, clauses: [CLASS_CLAUSE], trackedPaths: TRACKED_PATHS, includes,
    });
    expect(secondRun).toHaveBeenCalledExactlyOnceWith({
      repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, clauses: [ABSTRACT_CLAUSE], trackedPaths: TRACKED_PATHS, includes,
    });
    expect(firstRun).toHaveBeenCalledBefore(secondRun);
    expect(unusedRun).not.toHaveBeenCalled();
  });

  it("refuses an unadopted requested clause before loading or running a mechanism", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: EMPTY_OBSERVATIONS } });
    const modules = modulesLoading({ runner });
    await expect(runCheck(checkRequest({
      modules, scope: { clauses: [ABSTRACT] },
    }))).resolves.toMatchObject({ outcome: "failed", error: { kind: "arguments-invalid" } });
    expect(modules.load).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
  });

  it("reports actual evaluation counts and the three coverage states without inventing rows for unavailable mechanisms", async () => {
    const modules = modulesByPath({
      [RUNNER_PATH]: { runner: standaloneRunner({ runReturns: {
        outcome: "ok",
        value: { hits: [], evaluated: [{ clause: CLASS, files: [A, A, B] }, { clause: ABSTRACT, files: [] }] },
      } }) },
      [UNUSED_RUNNER_PATH]: { runner: standaloneRunner({ runReturns: {
        outcome: "ok", value: { hits: [], evaluated: [{ clause: UNREQUESTED, files: [] }] },
      } }) },
      [MISSING_RUNNER_PATH]: { runner: embeddedRunnerReporting({
        hits: [], evaluated: [], nativeExceptions: [], projection: "missing",
      }) },
      [ABSENT_RUNNER_PATH]: { runner: embeddedRunnerReporting({
        hits: [], evaluated: [], nativeExceptions: [], projection: "not-included",
      }) },
    });
    await expect(runCheck(checkRequest({
      selections: selectionsReading(COVERAGE_READING),
      modules,
      scope: { clauses: [ABSENT_NATIVE, ABSTRACT, MISSING_NATIVE, CLASS] },
    }))).resolves.toMatchObject({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        coverage: [
          { clause: CLASS, mechanism: WALKER, evaluation: "evaluated", scannedCount: 2 },
          { clause: ABSTRACT, mechanism: WALKER, evaluation: "not-applicable", scannedCount: 0 },
          { clause: UNREQUESTED, mechanism: UNUSED, evaluation: "not-requested", scannedCount: 0 },
        ],
        unmeasured: [
          { kind: "mechanism-not-run", mechanism: MISSING, projection: "missing" },
          { kind: "mechanism-not-run", mechanism: ABSENT, projection: "not-included" },
        ],
      },
    });
  });
});
