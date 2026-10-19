import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { CommandRequest } from "./run-check-command.ts";
import { runProjectCommand } from "./run-project-command.ts";

const ENTRY_URL = "file:///install/core/check/project-command.ts";
const NOT_A_FILE_URL = "https://example.invalid/core/check/project-command.ts";

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
  '["/install","rules","CD-14","discipline.json"]': "/install/rules/CD-14/discipline.json",
  '["/install","mechanisms","audit","CD-14","piece.json"]': "/install/mechanisms/audit/CD-14/piece.json",
  '["/install","mechanisms","audit","CD-14"]': "/install/mechanisms/audit/CD-14",
  '["/install","mechanisms","audit","runner","runner.ts"]': "/install/mechanisms/audit/runner/runner.ts",
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/core/check/project-command.ts": "/install/core/check",
  "/install/core/check": "/install/core",
  "/install/core": "/install",
};

type FileUrlResult = Result<
  AbsolutePath,
  { readonly kind: "not-a-file-url"; readonly url: string; readonly detail: string }
>;

const FILE_URLS: Readonly<Record<string, FileUrlResult>> = {
  [ENTRY_URL]: { outcome: "ok", value: absolutePathSchema.parse("/install/core/check/project-command.ts") },
  [NOT_A_FILE_URL]: {
    outcome: "failed",
    error: { kind: "not-a-file-url", url: NOT_A_FILE_URL, detail: "the text is not a file: URL" },
  },
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: ({ url }) => requiredEntry({ table: FILE_URLS, key: url }),
};

const REPO_RESOLVING_TO_NO_ABSOLUTE_PATH: PathPort = {
  ...TABLE_PATH,
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
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

describe("runProjectCommand", () => {
  it("exits 2 with the arguments-invalid line when an argument is unknown", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--base-revision", "main"] });

    await runProjectCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the install-root-unresolvable line when its module URL is not a file URL", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(commandRequest({ process: processPort, moduleUrl: NOT_A_FILE_URL }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [
        [{ text: expect.stringMatching(/^load failure: install-root-unresolvable https:\/\/example\.invalid\//) }],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the arguments-invalid line when --repo resolves to no absolute path", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runProjectCommand(commandRequest({ process: processPort, path: REPO_RESOLVING_TO_NO_ABSOLUTE_PATH }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the load failure line when the selection cannot be loaded", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": presentFile({ text: "{" }) }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 0 printing no projection line when every selected runner is standalone", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runProjectCommand(
      commandRequest({ process: processPort, fileText: fileTextOver(CLASS_SYNTAX_SELECTED), git: gitTracking([repoPathSchema.parse("src/a.ts")]) }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("loads the runner from the install three levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });

    await runProjectCommand(commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules }));

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/mechanisms/audit/runner/runner.ts" }],
    ]);
  });

  it("exits 2 with the arguments-invalid line when both --repo and the install root are unresolvable", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runProjectCommand(
      commandRequest({ process: processPort, path: REPO_RESOLVING_TO_NO_ABSOLUTE_PATH, moduleUrl: NOT_A_FILE_URL }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });
});
