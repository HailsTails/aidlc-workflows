import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitFailure, GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type CheckRequest, runCheck } from "./run-check.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const SELECTION_PATH = "/repo/disciplines.json";
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/mechanisms/walker/CD-14/piece.json";
const RUNNER_PATH = "/install/mechanisms/walker/runner/runner.ts";
const TEAM_ROOT = "/repo/rules/team";
const TEAM_DISCIPLINE_PATH = "/repo/rules/team/rules/CD-14/discipline.json";
const TEAM_PIECE_PATH = "/repo/rules/team/mechanisms/walker/CD-14/piece.json";
const HARNESS_SEGMENT = /(?:^|\/)\.(?:claude|kiro|codex|cursor|aidlc|opencode|github|copilot)(?:\/|$)/;

const CLASS_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };
const ABSTRACT_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" };

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const UNREADABLE_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: SELECTION_PATH, detail: "EACCES" } },
  presence: "present",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': SELECTION_PATH,
  '["/repo","discipline-exceptions.json"]': EXCEPTIONS_PATH,
  '["/install","rules","CD-14","discipline.json"]': DISCIPLINE_PATH,
  '["/install","mechanisms","walker","CD-14","piece.json"]': PIECE_PATH,
  '["/install","mechanisms","walker","CD-14"]': "/install/mechanisms/walker/CD-14",
  '["/install","mechanisms","walker","runner","runner.ts"]': RUNNER_PATH,
  '["/repo","rules/team"]': TEAM_ROOT,
  '["/repo/rules/team","rules","CD-14","discipline.json"]': TEAM_DISCIPLINE_PATH,
  '["/repo/rules/team","mechanisms","walker","CD-14","piece.json"]': TEAM_PIECE_PATH,
  '["/repo/rules/team","mechanisms","walker","CD-14"]': "/repo/rules/team/mechanisms/walker/CD-14",
  '["/repo","README.md"]': "/repo/README.md",
  '["/repo","package.json"]': "/repo/package.json",
  '["/repo","src/a.ts"]': "/repo/src/a.ts",
  '["/repo","src/b.tsx"]': "/repo/src/b.tsx",
  '["/repo","src/c.mts"]': "/repo/src/c.mts",
  '["/repo","src/d.cts"]': "/repo/src/d.cts",
  '["/repo","src/e.js"]': "/repo/src/e.js",
  '["/repo","src/f.json"]': "/repo/src/f.json",
  '["/repo","src/factory.ts"]': "/repo/src/factory.ts",
  '["/repo","src/gone.ts"]': "/repo/src/gone.ts",
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  [PIECE_PATH]: "/install/mechanisms/walker/CD-14",
  [DISCIPLINE_PATH]: "/install/rules/CD-14",
  [RUNNER_PATH]: "/install/mechanisms/walker/runner",
  [TEAM_PIECE_PATH]: "/repo/rules/team/mechanisms/walker/CD-14",
  [TEAM_DISCIPLINE_PATH]: "/repo/rules/team/rules/CD-14",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => z.string().parse(JOINED_PATHS[JSON.stringify(segments)]),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => z.string().parse(DIRECTORIES[path]),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => absolutePathSchema.parse(path),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const CASES = {
  flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
  allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
};

const CLASS_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["walker"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: CASES,
};

const ABSTRACT_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "abstract-syntax",
  summary: "no abstract syntax",
  mechanisms: ["walker"],
  anchor: { kind: "keyword", keyword: "abstract" },
  cases: CASES,
};

const DISCIPLINE = JSON.stringify({ version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] });

const DISCIPLINE_WITH_TWO_CLAUSES = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [CLASS_SYNTAX_DEFINITION, ABSTRACT_SYNTAX_DEFINITION],
});

const PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
});

const PIECE_WITH_TWO_CLAUSES = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [
    { clause: "class-syntax", settings: { module: "class-syntax.ts" } },
    { clause: "abstract-syntax", settings: { module: "abstract-syntax.ts" } },
  ],
});

const SELECTION = JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } });

const SELECTION_OF_TWO_CLAUSES = JSON.stringify({
  version: 1,
  ruleSets: {},
  clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "walker" },
});

const WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "plugins/rin/tools/rin-harness-why-chain.ts:9",
};

const CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "the walker's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const EXCEPTIONS_WITH_FILE_CARVE_OUT = JSON.stringify({
  version: 1,
  exceptions: [
    {
      kind: "file-carve-out",
      clause: "CD-14#class-syntax",
      file: "src/legacy.ts",
      reason: "legacy class awaiting paydown",
      whyChain: CHAIN,
    },
  ],
});

const EXCEPTIONS_WITH_FILE_CARVE_OUT_ON_GONE = JSON.stringify({
  version: 1,
  exceptions: [
    {
      kind: "file-carve-out",
      clause: "CD-14#class-syntax",
      file: "src/gone.ts",
      reason: "legacy class awaiting paydown",
      whyChain: CHAIN,
    },
  ],
});

const EXCEPTIONS_WITH_AUTHORISED_LOCATION = JSON.stringify({
  version: 1,
  exceptions: [
    {
      kind: "authorised-location",
      clause: "CD-14#class-syntax",
      file: "src/factory.ts",
      reason: "the wrapping factory for the library",
    },
  ],
});

const WORKING_TREE: Readonly<Record<string, FakeFile>> = {
  "/repo/README.md": presentFile({ text: "" }),
  "/repo/package.json": presentFile({ text: "" }),
  "/repo/src/a.ts": presentFile({ text: "" }),
  "/repo/src/b.tsx": presentFile({ text: "" }),
  "/repo/src/c.mts": presentFile({ text: "" }),
  "/repo/src/d.cts": presentFile({ text: "" }),
  "/repo/src/e.js": presentFile({ text: "" }),
  "/repo/src/f.json": presentFile({ text: "" }),
  "/repo/src/factory.ts": presentFile({ text: "" }),
  "/repo/src/gone.ts": ABSENT_FILE,
};

const INSTALL: Readonly<Record<string, FakeFile>> = {
  ...WORKING_TREE,
  [SELECTION_PATH]: presentFile({ text: SELECTION }),
  [EXCEPTIONS_PATH]: ABSENT_FILE,
  [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
};

const TEAM_INSTALL: Readonly<Record<string, FakeFile>> = {
  ...WORKING_TREE,
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({ version: 1, ruleSets: { team: "rules/team" }, clauses: { "team/CD-14#class-syntax": "walker" } }),
  }),
  [EXCEPTIONS_PATH]: ABSENT_FILE,
  [TEAM_DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE }),
  [TEAM_PIECE_PATH]: presentFile({ text: PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
};

const TRACKED_PATHS = z
  .array(repoPathSchema)
  .parse(["README.md", "package.json", "src/a.ts", "src/b.tsx", "src/c.mts", "src/d.cts", "src/e.js", "src/f.json"]);

const CHANGED_PATHS = z.array(repoPathSchema).parse(["src/a.ts"]);

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

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

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitReporting = (request: {
  readonly trackedPaths: Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: Result<readonly RepoPath[], GitFailure>;
}): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.trackedPaths),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue(request.changedSince),
});

const MEASURED_GIT = gitReporting({
  trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
  changedSince: { outcome: "ok", value: CHANGED_PATHS },
});

const checkRequest = (overrides: Partial<CheckRequest>): CheckRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  baseRevision: "main",
  fileText: fileTextOver(INSTALL),
  modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) }),
  path: TABLE_PATH,
  git: MEASURED_GIT,
  ...overrides,
});

describe("runCheck reports", () => {
  it("is a pass report when the runner flags nothing", async () => {
    await expect(runCheck(checkRequest({}))).resolves.toEqual({ outcome: "ok", value: EMPTY_REPORT });
  });

  it("reports the runner's hit as a finding attributed to its mechanism", async () => {
    await expect(
      runCheck(
        checkRequest({
          modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [HIT_IN_A] } }) }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: { ...EMPTY_REPORT, findings: [{ ...HIT_IN_A, mechanism: "walker" }] },
    });
  });

  it("exempts a finding an authorised location names and credits the location", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_AUTHORISED_LOCATION }) }),
          modules: modulesLoading({
            runner: standaloneRunner({ runReturns: { outcome: "ok", value: [{ ...HIT_IN_A, file: "src/factory.ts" }] } }),
          }),
          git: gitReporting({
            trackedPaths: { outcome: "ok", value: z.array(repoPathSchema).parse(["src/factory.ts"]) },
            changedSince: { outcome: "ok", value: [] },
          }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        ...EMPTY_REPORT,
        exempted: [
          {
            finding: { ...HIT_IN_A, file: "src/factory.ts", mechanism: "walker" },
            by: [
              {
                kind: "authorised-location",
                clause: CLASS_SYNTAX_OBJECT,
                mechanism: "walker",
                file: "src/factory.ts",
                reason: "the wrapping factory for the library",
              },
            ],
          },
        ],
      },
    });
  });

  it("lists an invalid exception record without failing the load", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({
                version: 1,
                exceptions: [{ kind: "authorised-location", clause: "CD-15#no-for-of", file: "src/a.ts", reason: "loop" }],
              }),
            }),
          }),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { invalidRecords: [{ index: 0, problem: { kind: "clause-not-selected" } }] },
    });
  });

  it("lists the uncovered mechanical clauses of an adopted discipline", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE_WITH_TWO_CLAUSES }),
          }),
        }),
      ),
    ).resolves.toEqual({ outcome: "ok", value: { ...EMPTY_REPORT, uncovered: [ABSTRACT_SYNTAX_OBJECT] } });
  });
});

describe("runCheck forfeiture measurement", () => {
  it("reports forfeiture-unmeasured when no base revision is given and a file carve-out exists", async () => {
    await expect(
      runCheck(
        checkRequest({
          baseRevision: undefined,
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_FILE_CARVE_OUT }) }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [{ kind: "forfeiture-unmeasured" }] } });
  });

  it("reports forfeiture-unmeasured when git cannot measure the change set and a file carve-out exists", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_FILE_CARVE_OUT }) }),
          git: gitReporting({
            trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
            changedSince: {
              outcome: "failed",
              error: { kind: "git-failed", command: "git diff", detail: "bad revision 'main'" },
            },
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [{ kind: "forfeiture-unmeasured" }] } });
  });

  it("reports nothing unmeasured when no base revision is given and no file carve-out exists", async () => {
    await expect(runCheck(checkRequest({ baseRevision: undefined }))).resolves.toEqual({
      outcome: "ok",
      value: EMPTY_REPORT,
    });
  });

  it("reports nothing unmeasured when no base revision is given and only an authorised location exists", async () => {
    await expect(
      runCheck(
        checkRequest({
          baseRevision: undefined,
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_AUTHORISED_LOCATION }) }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [] } });
  });

  it("reports nothing unmeasured when the change set is measured and a file carve-out exists", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_FILE_CARVE_OUT }) }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { unmeasured: [] } });
  });

  it("forfeits a file carve-out whose file the measured change set touched", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_FILE_CARVE_OUT }) }),
          git: gitReporting({
            trackedPaths: { outcome: "ok", value: TRACKED_PATHS },
            changedSince: { outcome: "ok", value: z.array(repoPathSchema).parse(["src/legacy.ts"]) },
          }),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { forfeited: [{ kind: "file-carve-out", file: "src/legacy.ts" }], stale: [] },
    });
  });
});

describe("runCheck runner dispatch", () => {
  it("loads the runner module once from the install's mechanism runner path", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });
    const report = await runCheck(
      checkRequest({
        modules,
        fileText: fileTextOver({
          ...INSTALL,
          [SELECTION_PATH]: presentFile({ text: SELECTION_OF_TWO_CLAUSES }),
          [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE_WITH_TWO_CLAUSES }),
          [PIECE_PATH]: presentFile({ text: PIECE_WITH_TWO_CLAUSES }),
        }),
      }),
    );
    expect({ report, loads: vi.mocked(modules.load).mock.calls }).toEqual({
      report: { outcome: "ok", value: EMPTY_REPORT },
      loads: [[{ path: RUNNER_PATH }]],
    });
  });

  it("calls run once for the mechanism with every selected clause, the TypeScript files and the tracked paths", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: [] } });
    await runCheck(
      checkRequest({
        modules: modulesLoading({ runner }),
        fileText: fileTextOver({
          ...INSTALL,
          [SELECTION_PATH]: presentFile({ text: SELECTION_OF_TWO_CLAUSES }),
          [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE_WITH_TWO_CLAUSES }),
          [PIECE_PATH]: presentFile({ text: PIECE_WITH_TWO_CLAUSES }),
        }),
      }),
    );
    expect(vi.mocked(runner.run).mock.calls).toEqual([
      [
        {
          repoRoot: "/repo",
          installRoot: "/install",
          files: ["src/a.ts", "src/b.tsx", "src/c.mts", "src/d.cts"],
          trackedPaths: TRACKED_PATHS,
          clauses: [
            {
              address: CLASS_SYNTAX_OBJECT,
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/install/mechanisms/walker/CD-14",
              settings: { module: "class-syntax.ts" },
            },
            {
              address: ABSTRACT_SYNTAX_OBJECT,
              anchor: { kind: "keyword", keyword: "abstract" },
              pieceRoot: "/install/mechanisms/walker/CD-14",
              settings: { module: "abstract-syntax.ts" },
            },
          ],
        },
      ],
    ]);
  });

  it("reads disciplines.json, the discipline file and the piece file exactly once each", async () => {
    const fileText = fileTextOver(INSTALL);
    const reads = vi.spyOn(fileText, "read");
    await runCheck(checkRequest({ fileText }));
    expect({ count: reads.mock.calls.length, calls: reads.mock.calls }).toEqual({
      count: 3,
      calls: expect.arrayContaining([[{ path: SELECTION_PATH }], [{ path: DISCIPLINE_PATH }], [{ path: PIECE_PATH }]]),
    });
  });

  it("drops a tracked path absent from the working tree from both the files and the tracked paths it runs on", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: [] } });
    await runCheck(
      checkRequest({
        modules: modulesLoading({ runner }),
        git: gitReporting({
          trackedPaths: { outcome: "ok", value: z.array(repoPathSchema).parse(["README.md", "src/a.ts", "src/gone.ts"]) },
          changedSince: { outcome: "ok", value: [] },
        }),
      }),
    );
    expect(vi.mocked(runner.run).mock.calls).toEqual([
      [expect.objectContaining({ files: ["src/a.ts"], trackedPaths: ["README.md", "src/a.ts"] })],
    ]);
  });

  it("still forfeits a carve-out on a tracked path absent from the working tree that the change set touched", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: [] } });

    const checked = await runCheck(
      checkRequest({
        fileText: fileTextOver({ ...INSTALL, [EXCEPTIONS_PATH]: presentFile({ text: EXCEPTIONS_WITH_FILE_CARVE_OUT_ON_GONE }) }),
        modules: modulesLoading({ runner }),
        git: gitReporting({
          trackedPaths: { outcome: "ok", value: z.array(repoPathSchema).parse(["src/a.ts", "src/gone.ts"]) },
          changedSince: { outcome: "ok", value: z.array(repoPathSchema).parse(["src/gone.ts"]) },
        }),
      }),
    );

    expect({ checked, runs: vi.mocked(runner.run).mock.calls }).toMatchObject({
      checked: { outcome: "ok", value: { forfeited: [{ kind: "file-carve-out", file: "src/gone.ts" }] } },
      runs: [[{ files: ["src/a.ts"], trackedPaths: ["src/a.ts"] }]],
    });
  });

  it("touches only the consumer files and the install, none under a harness directory, and writes nothing", async () => {
    const fileText = fileTextOver(INSTALL);
    const reads = vi.spyOn(fileText, "read");
    const existenceChecks = vi.spyOn(fileText, "exists");
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });
    const report = await runCheck(checkRequest({ fileText, modules }));
    expect({
      report,
      readsWithoutHarness: reads.mock.calls,
      readsOfTheConsumerFile: reads.mock.calls,
      existenceChecksWithoutHarness: existenceChecks.mock.calls,
      existenceChecksOfTheRunner: existenceChecks.mock.calls,
      writes: vi.mocked(fileText.write).mock.calls,
      loads: vi.mocked(modules.load).mock.calls,
    }).toEqual({
      report: { outcome: "ok", value: EMPTY_REPORT },
      readsWithoutHarness: expect.not.arrayContaining([[{ path: expect.stringMatching(HARNESS_SEGMENT) }]]),
      readsOfTheConsumerFile: expect.arrayContaining([[{ path: SELECTION_PATH }]]),
      existenceChecksWithoutHarness: expect.not.arrayContaining([[{ path: expect.stringMatching(HARNESS_SEGMENT) }]]),
      existenceChecksOfTheRunner: expect.arrayContaining([[{ path: RUNNER_PATH }]]),
      writes: [],
      loads: expect.not.arrayContaining([[{ path: expect.stringMatching(HARNESS_SEGMENT) }]]),
    });
  });

  it("roots a named rule set's piece under the consumer's rule-set directory and still loads the install's runner", async () => {
    const runner = standaloneRunner({ runReturns: { outcome: "ok", value: [] } });
    const modules = modulesLoading({ runner });
    const report = await runCheck(checkRequest({ fileText: fileTextOver(TEAM_INSTALL), modules }));
    expect({
      report,
      runCalls: vi.mocked(runner.run).mock.calls,
      loads: vi.mocked(modules.load).mock.calls,
    }).toEqual({
      report: { outcome: "ok", value: EMPTY_REPORT },
      runCalls: [
        [
          expect.objectContaining({
            clauses: [
              {
                address: { ruleSet: { name: "team" }, discipline: "CD-14", clause: "class-syntax" },
                anchor: { kind: "keyword", keyword: "class" },
                pieceRoot: "/repo/rules/team/mechanisms/walker/CD-14",
                settings: { module: "class-syntax.ts" },
              },
            ],
          }),
        ],
      ],
      loads: [[{ path: RUNNER_PATH }]],
    });
  });
});

describe("runCheck load failures", () => {
  it("is file-unreadable for an unreadable disciplines.json", async () => {
    await expect(
      runCheck(checkRequest({ fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: UNREADABLE_FILE }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-unreadable", path: SELECTION_PATH } });
  });

  it("is file-malformed for a disciplines.json that is not JSON", async () => {
    await expect(
      runCheck(checkRequest({ fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{" }) }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH } });
  });

  it("is unsupported-version for a disciplines.json of version 2", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [SELECTION_PATH]: presentFile({ text: JSON.stringify({ version: 2, ruleSets: {}, clauses: {} }) }),
          }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: SELECTION_PATH, found: 2 },
    });
  });

  it("is file-malformed for a discipline-exceptions.json with an unknown exception kind", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [EXCEPTIONS_PATH]: presentFile({
              text: JSON.stringify({ version: 1, exceptions: [{ kind: "blanket-waiver", clause: "CD-14#class-syntax" }] }),
            }),
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: EXCEPTIONS_PATH } });
  });

  it("is rule-set-invalid for a discipline.json whose id differs from its folder", async () => {
    await expect(
      runCheck(
        checkRequest({
          fileText: fileTextOver({
            ...INSTALL,
            [DISCIPLINE_PATH]: presentFile({ text: JSON.stringify({ version: 1, id: "CD-15", clauses: [CLASS_SYNTAX_DEFINITION] }) }),
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH } });
  });

  it("is runner-missing when the mechanism has no runner.ts in the install", async () => {
    await expect(
      runCheck(checkRequest({ fileText: fileTextOver({ ...INSTALL, [RUNNER_PATH]: ABSENT_FILE }) })),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "runner-missing", mechanism: "walker" } });
  });

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    await expect(
      runCheck(
        checkRequest({
          modules: modulesLoading({
            runner: { ...standaloneRunner({ runReturns: { outcome: "ok", value: [] } }), exceptionPath: "unknown-path" },
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "walker" } });
  });

  it("is runner-invalid with the loader's detail when the runner module fails to load", async () => {
    await expect(
      runCheck(
        checkRequest({
          modules: {
            load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
              outcome: "failed",
              error: { kind: "module-unloadable", path: RUNNER_PATH, detail: "Cannot find package 'typescript'" },
            }),
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-invalid", mechanism: "walker", detail: "Cannot find package 'typescript'" },
    });
  });

  it("is runner-invalid for a runner module with no runner export", async () => {
    await expect(
      runCheck(checkRequest({ modules: modulesLoading({ createWalkerRunner: vi.fn() }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "walker" } });
  });

  it("is git-failed when git cannot list the tracked paths", async () => {
    await expect(
      runCheck(
        checkRequest({
          git: gitReporting({
            trackedPaths: { outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a git repository" } },
            changedSince: { outcome: "ok", value: CHANGED_PATHS },
          }),
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "git-failed" } });
  });

  it("is runner-failed carrying the runner's own failure", async () => {
    await expect(
      runCheck(
        checkRequest({
          modules: modulesLoading({
            runner: standaloneRunner({
              runReturns: { outcome: "failed", error: { kind: "file-unparseable", file: "src/a.ts", detail: "unexpected token" } },
            }),
          }),
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-failed",
        mechanism: "walker",
        failure: { kind: "file-unparseable", file: "src/a.ts", detail: "unexpected token" },
      },
    });
  });

  it("is runner-failed with runner-invalid-output when the runner returns a value that is not a result", async () => {
    await expect(
      runCheck(checkRequest({ modules: modulesLoading({ runner: standaloneRunner({ runReturns: [HIT_IN_A] }) }) })),
    ).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-failed", mechanism: "walker", failure: { kind: "runner-invalid-output" } },
    });
  });
});
