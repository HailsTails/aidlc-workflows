import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LoadedRunner } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import { createPathPort, type PathPort } from "../platform-ports/path-port.ts";
import type { ProcessPort } from "../platform-ports/process-port.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { type CommandRequest, runCheckCommand } from "./run-check-command.ts";

const ENTRY_URL = "file:///install/core/check/check-command.ts";
const NOT_A_FILE_URL = "https://example.invalid/core/check/check-command.ts";
const UNC_LIKE = "\\\\server\\share";

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
  mechanisms: ["walker"],
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
    text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
  }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({
    text: JSON.stringify({ version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] }),
  }),
  "/install/mechanisms/walker/CD-14/piece.json": presentFile({
    text: JSON.stringify({
      version: 1,
      discipline: "CD-14",
      mechanism: "walker",
      clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
    }),
  }),
  "/install/mechanisms/walker/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const POSIX_PATH = createPathPort({ workingDirectory: () => "/work" });

const WORKING_DIRECTORY_GONE: PathPort = createPathPort({
  workingDirectory: vi
    .fn<(request: Record<string, never>) => string>()
    .mockThrow(new Error("ENOENT: process.cwd failed, no such file or directory")),
});

const RESOLVED: Readonly<Record<string, string>> = {
  "/install": "/install",
  "/repo": "/repo",
  "relative-repo": UNC_LIKE,
};

const REPO_RESOLVING_TO_NO_ABSOLUTE_PATH: PathPort = {
  ...POSIX_PATH,
  resolve: ({ path }) => z.string().parse(RESOLVED[path]),
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

const gitTracking = (paths: readonly string[]): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: z.array(repoPathSchema).parse(paths) }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (overrides: Partial<CommandRequest>): CommandRequest => ({
  process: processWith({ arguments: ["--repo", "/repo"] }),
  path: POSIX_PATH,
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

  it("exits 2 with the install-root-unresolvable line when its module URL is not a file URL", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(commandRequest({ process: processPort, moduleUrl: NOT_A_FILE_URL }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [
        [{ text: expect.stringMatching(/^load failure: install-root-unresolvable https:\/\/example\.invalid\//) }],
      ],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the arguments-invalid line when the working directory cannot be read to resolve --repo", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runCheckCommand(commandRequest({ process: processPort, path: WORKING_DIRECTORY_GONE }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the arguments-invalid line when --repo resolves to no absolute path", async () => {
    const processPort = processWith({ arguments: ["--repo", "relative-repo"] });

    await runCheckCommand(commandRequest({ process: processPort, path: REPO_RESOLVING_TO_NO_ABSOLUTE_PATH }));

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
        git: gitTracking(["src/a.ts"]),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "findings (1)\nCD-14#class-syntax walker src/a.ts:3:0 class A {}\nverdict: fail\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("loads the runner from the install three levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: [] } }) });

    await runCheckCommand(
      commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules, git: gitTracking(["src/a.ts"]) }),
    );

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/mechanisms/walker/runner/runner.ts" }],
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
