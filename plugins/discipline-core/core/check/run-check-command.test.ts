import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import { type CommandRequest, runCheckCommand } from "./run-check-command.ts";

const ENTRY_URL = "file:///install/core/check/check-command.ts";

type FakeFile = {
  readonly read: ReturnType<FileTextPort["read"]>;
  readonly presence: ReturnType<FileTextPort["exists"]>;
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const CLASS_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["audit"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: {
    flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
    allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
  },
};

const NOTHING_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentFile({ text: JSON.stringify({ version: 1, ruleSets: {}, clauses: {} }) }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
};

const CLASS_SYNTAX_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/repo/disciplines.json": presentFile({
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "audit" } }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({
    text: JSON.stringify({ version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] }),
  }),
  "/install/mechanisms/audit/CD-14/piece.json": presentFile({
    text: JSON.stringify({
      version: 1,
      discipline: "CD-14",
      mechanism: "audit",
      clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
    }),
  }),
  "/install/mechanisms/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': "/repo/disciplines.json",
  '["/repo","discipline-exceptions.json"]': "/repo/discipline-exceptions.json",
  '["/repo","src/a.ts"]': "/repo/src/a.ts",
  '["/install","rules","CD-14","discipline.json"]': "/install/rules/CD-14/discipline.json",
  '["/install","mechanisms","audit","CD-14","piece.json"]': "/install/mechanisms/audit/CD-14/piece.json",
  '["/install","mechanisms","audit","CD-14"]': "/install/mechanisms/audit/CD-14",
  '["/install","mechanisms","audit","runner","runner.ts"]': "/install/mechanisms/audit/runner/runner.ts",
};

const FILE_PATHS: Readonly<Record<string, string>> = {
  [ENTRY_URL]: "/install/core/check/check-command.ts",
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/core/check/check-command.ts": "/install/core/check",
  "/install/core/check": "/install/core",
  "/install/core": "/install",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: ({ url }) => ({ outcome: "ok", value: absolutePathSchema.parse(FILE_PATHS[url]) }),
};

const HIT_IN_A = {
  clause: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitTracking = (paths: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: paths }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (overrides: Partial<CommandRequest>): CommandRequest => ({
  process: processWith({ arguments: ["--repo", "/repo"] }),
  path: TABLE_PATH,
  fileText: fileTextOver(NOTHING_SELECTED),
  modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) }),
  git: gitTracking([]),
  moduleUrl: ENTRY_URL,
  ...overrides,
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runCheckCommand", () => {
  it("exits 2 with the arguments-invalid line when an argument is unknown", async () => {
    const processPort = processWith({ arguments: ["--bogus", "x"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 0 printing the pass verdict when the report is clean", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "verdict: pass\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 writing the report once when the runner finds a hit", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver(CLASS_SYNTAX_SELECTED),
        modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [HIT_IN_A] } }) }),
        git: gitTracking([repoPathSchema.parse("src/a.ts")]),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("loads the runner from the install three levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });

    await runCheckCommand(
      commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules, git: gitTracking([repoPathSchema.parse("src/a.ts")]) }),
    );

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/mechanisms/audit/runner/runner.ts" }],
    ]);
  });

  it("measures the change set against the --base-revision it is given", async () => {
    const git = gitTracking([]);

    await runCheckCommand(
      commandRequest({ process: processWith({ arguments: ["--repo", "/repo", "--base-revision", "main"] }), git }),
    );

    expect(vi.mocked(git.changedSince).mock.calls).toEqual([[{ repoRoot: "/repo", baseRevision: "main" }]]);
  });
});
