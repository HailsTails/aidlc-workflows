import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type ProjectRequest, runProject } from "./run-project.ts";

const SELECTION_PATH = "/repo/disciplines.json";
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/mechanisms/audit/CD-14/piece.json";
const RUNNER_PATH = "/install/mechanisms/audit/runner/runner.ts";
const LINT_PIECE_PATH = "/install/mechanisms/lint/CD-14/piece.json";
const LINT_RUNNER_PATH = "/install/mechanisms/lint/runner/runner.ts";

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

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': SELECTION_PATH,
  '["/repo","discipline-exceptions.json"]': EXCEPTIONS_PATH,
  '["/install","rules","CD-14","discipline.json"]': DISCIPLINE_PATH,
  '["/install","mechanisms","audit","CD-14","piece.json"]': PIECE_PATH,
  '["/install","mechanisms","audit","CD-14"]': "/install/mechanisms/audit/CD-14",
  '["/install","mechanisms","audit","runner","runner.ts"]': RUNNER_PATH,
  '["/install","mechanisms","lint","CD-14","piece.json"]': LINT_PIECE_PATH,
  '["/install","mechanisms","lint","CD-14"]': "/install/mechanisms/lint/CD-14",
  '["/install","mechanisms","lint","runner","runner.ts"]': LINT_RUNNER_PATH,
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  [PIECE_PATH]: "/install/mechanisms/audit/CD-14",
  [DISCIPLINE_PATH]: "/install/rules/CD-14",
  [RUNNER_PATH]: "/install/mechanisms/audit/runner",
  [LINT_PIECE_PATH]: "/install/mechanisms/lint/CD-14",
  [LINT_RUNNER_PATH]: "/install/mechanisms/lint/runner",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const DISCIPLINE = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "no class syntax",
      mechanisms: ["audit"],
      anchor: { kind: "keyword", keyword: "class" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
  ],
});

const PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "audit",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
});

const INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" } }),
  }),
  [EXCEPTIONS_PATH]: ABSENT_FILE,
  [DISCIPLINE_PATH]: presentFile({ text: DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
};

const TWO_MECHANISM_DISCIPLINE = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "no class syntax",
      mechanisms: ["audit"],
      anchor: { kind: "keyword", keyword: "class" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
    {
      kind: "mechanical",
      id: "abstract-syntax",
      summary: "no abstract syntax",
      mechanisms: ["lint"],
      anchor: { kind: "keyword", keyword: "abstract" },
      cases: {
        flag: [{ name: "flagged", fileName: "src/a.ts", source: "abstract class A {}\n", expectedLines: [1] }],
        allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
      },
    },
  ],
});

const LINT_PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "lint",
  clauses: [{ clause: "abstract-syntax", settings: { module: "abstract-syntax.ts" } }],
});

const TWO_MECHANISM_INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: presentFile({
    text: JSON.stringify({
      version: 1,
      ruleSets: {},
      clauses: { "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "lint" },
    }),
  }),
  [EXCEPTIONS_PATH]: presentFile({
    text: JSON.stringify({
      version: 1,
      exceptions: [
        { kind: "authorised-location", clause: "CD-14#class-syntax", file: "src/walker.ts", reason: "audit location", provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" } },
        { kind: "authorised-location", clause: "CD-14#abstract-syntax", file: "src/lint.ts", reason: "lint location", provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" } },
      ],
    }),
  }),
  [DISCIPLINE_PATH]: presentFile({ text: TWO_MECHANISM_DISCIPLINE }),
  [PIECE_PATH]: presentFile({ text: PIECE }),
  [LINT_PIECE_PATH]: presentFile({ text: LINT_PIECE }),
  [RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
  [LINT_RUNNER_PATH]: presentFile({ text: "export const runner = {};\n" }),
};

const WALKER_RECORD = {
  kind: "authorised-location",
  clause: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
  mechanism: "audit",
  file: "src/walker.ts",
  reason: "audit location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/check/run-project.test.ts; not historical authorisation" },
};

const modulesByPath = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});

const standaloneRunner = (): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const GIT: GitPort = {
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({
    outcome: "ok",
    value: [repoPathSchema.parse("src/a.ts")],
  }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
};

const projectRequest = (overrides: Partial<ProjectRequest>): ProjectRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  installRoot: absolutePathSchema.parse("/install"),
  fileText: fileTextOver(INSTALL),
  modules: modulesLoading({ runner: standaloneRunner() }),
  path: TABLE_PATH,
  git: GIT,
  ...overrides,
});

describe("runProject", () => {
  it("returns no projection writes with a standalone runner, writing no file and running nothing", async () => {
    const fileText = fileTextOver(INSTALL);
    const runner = standaloneRunner();
    const writes = await runProject(projectRequest({ fileText, modules: modulesLoading({ runner }) }));
    expect({
      writes,
      fileWrites: vi.mocked(fileText.write).mock.calls,
      runCalls: vi.mocked(runner.run).mock.calls,
      conformCalls: vi.mocked(runner.conform).mock.calls,
    }).toEqual({
      writes: { outcome: "ok", value: [] },
      fileWrites: [],
      runCalls: [],
      conformCalls: [],
    });
  });

  it("loads the runner module once from the install's mechanism runner path", async () => {
    const modules = modulesLoading({ runner: standaloneRunner() });
    const writes = await runProject(projectRequest({ modules }));
    expect({ writes, loads: vi.mocked(modules.load).mock.calls }).toEqual({
      writes: { outcome: "ok", value: [] },
      loads: [[{ path: RUNNER_PATH }]],
    });
  });

  it("is not a load failure when the exceptions file holds an invalid record", async () => {
    await expect(
      runProject(
        projectRequest({
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
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("is file-malformed for a disciplines.json that is not JSON", async () => {
    await expect(
      runProject(projectRequest({ fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{" }) }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "file-malformed", path: SELECTION_PATH } });
  });

  it("is file-malformed for a discipline-exceptions.json with an unknown exception kind", async () => {
    await expect(
      runProject(
        projectRequest({
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

  it("is runner-invalid for a runner export whose exception path is outside every path", async () => {
    await expect(
      runProject(projectRequest({ modules: modulesLoading({ runner: { ...standaloneRunner(), exceptionPath: "unknown-path" } }) })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "runner-invalid", mechanism: "audit" } });
  });
});

describe("runProject with an embedded runner", () => {
  it("returns the runner's projection write without running the check", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } }),
    };
    const writes = await runProject(projectRequest({ modules: modulesLoading({ runner }) }));
    expect({ writes, runCalls: runner.run.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      runCalls: [],
    });
  });

  it("hands the runner's projection only the records of its own mechanism", async () => {
    const runner = {
      exceptionPath: "embedded",
      projectedKinds: ["config-override"],
      run: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      conform: vi.fn<(request: unknown) => Promise<unknown>>().mockResolvedValue({ outcome: "ok", value: [] }),
      project: vi
        .fn<(request: unknown) => Promise<unknown>>()
        .mockResolvedValue({ outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } }),
    };
    const writes = await runProject(
      projectRequest({
        fileText: fileTextOver(TWO_MECHANISM_INSTALL),
        modules: modulesByPath({ [RUNNER_PATH]: { runner }, [LINT_RUNNER_PATH]: { runner: standaloneRunner() } }),
      }),
    );
    expect({ writes, projectCalls: runner.project.mock.calls }).toEqual({
      writes: { outcome: "ok", value: [{ path: "disciplines.eslint.mjs", effect: "written" }] },
      projectCalls: [[expect.objectContaining({ records: [WALKER_RECORD] })]],
    });
  });
});
