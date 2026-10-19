import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { DirectoryPort } from "../../../core/platform-ports/file-system-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { type ClauseAddress, clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import { requiredEntry } from "../../../tests/required-entry.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { createDefaultParsePort, type SyntaxNode, type TypeScriptParsePort } from "./typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerPiece } from "./walker-piece.ts";

const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const PIECE_ROOT = "/install/mechanisms/walker/XX-1";
const FIRST_MODULE = "/install/mechanisms/walker/XX-1/first.ts";
const SECOND_MODULE = "/install/mechanisms/walker/XX-1/second.ts";
const ALPHA = repoPathSchema.parse("src/alpha.ts");
const BETA = repoPathSchema.parse("src/beta.ts");
const TRACKED_ONLY = repoPathSchema.parse("src/tracked-only.ts");
const FIRST_ADDRESS = clauseAddressSchema.parse("XX-1#first-check");
const SECOND_ADDRESS = clauseAddressSchema.parse("XX-1#second-check");

const clauseFor = (request: { readonly address: ClauseAddress; readonly settings: unknown }): RunnerClause => ({
  address: request.address,
  anchor: { kind: "source" },
  pieceRoot: PIECE_ROOT,
  settings: request.settings,
});
const FIRST_CLAUSE = clauseFor({ address: FIRST_ADDRESS, settings: { module: "first.ts" } });
const SECOND_CLAUSE = clauseFor({ address: SECOND_ADDRESS, settings: { module: "second.ts" } });
const ALPHA_HIT = { clause: FIRST_ADDRESS, file: ALPHA, anchor: { line: 9, column: 1 }, snippet: "first" };
const FINISH_HIT = { clause: FIRST_ADDRESS, file: ALPHA, anchor: { line: 2, column: 0 }, snippet: "finished" };

const readingText = (request: { readonly text: string }) =>
  vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text });
const loadingNamespace = (request: { readonly namespace: unknown }) =>
  vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: request.namespace });
const parsingTo = (request: { readonly nodes: readonly SyntaxNode[] }) => {
  const tree = SYNTAX_API.createSourceFile("fixture.ts", "", SYNTAX_API.ScriptTarget.Latest, true);
  return {
    syntaxApi: SYNTAX_API,
    parse: vi.fn<TypeScriptParsePort["parse"]>().mockReturnValue(tree),
    children: () => request.nodes,
  };
};
const EMPTY_PREPARED: PreparedWalkerCheck = {
  prepareFile: () => ({ outcome: "ok", value: { kind: "complete", hits: [] } }),
  finish: () => ({ outcome: "ok", value: [] }),
};
const SYNTAX_PREPARED: PreparedWalkerCheck = {
  prepareFile: () => ({ outcome: "ok", value: { kind: "syntax", begin: () => ({ finish: () => [] }) } }),
  finish: () => ({ outcome: "ok", value: [] }),
};
const pieceWith = (request: { readonly prepared: PreparedWalkerCheck }): WalkerPiece => ({
  prepare: () => ({ outcome: "ok", value: request.prepared }),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","src/alpha.ts"]': "/repo/src/alpha.ts",
  '["/repo","src/beta.ts"]': "/repo/src/beta.ts",
  '["/install/mechanisms/walker/XX-1","first.ts"]': FIRST_MODULE,
  '["/install/mechanisms/walker/XX-1","second.ts"]': SECOND_MODULE,
  '["/repo","src"]': "/repo/src",
  '["/repo/src","alpha.ts"]': "/repo/src/alpha.ts",
  '["/repo","tests"]': "/repo/tests",
  '["/repo","tools"]': "/repo/tools",
  '["/repo","tsconfig.json"]': "/repo/tsconfig.json",
  '["/repo/src","untracked.ts"]': "/repo/src/untracked.ts",
  '["/repo/tests","example.test.js"]': "/repo/tests/example.test.js",
  '["/repo/tools","core"]': "/repo/tools/core",
  '["/repo/tools","kept.ts"]': "/repo/tools/kept.ts",
  '["/repo","src/untracked.ts"]': "/repo/src/untracked.ts",
  '["/repo","tests/example.test.js"]': "/repo/tests/example.test.js",
  '["/repo","tools/kept.ts"]': "/repo/tools/kept.ts",
  '["/repo/tools/core/mechanisms/walker/XX-1","first.ts"]': "/repo/tools/core/mechanisms/walker/XX-1/first.ts",
};

const PREPARED_RELATIVE_PATHS: Readonly<Record<string, string>> = {
  '["/repo","/repo/tools/core"]': "tools/core",
  '["/repo","/repo/src"]': "src",
  '["/repo","/repo/tests"]': "tests",
  '["/repo","/repo/tools"]': "tools",
  '["/repo","/repo/src/untracked.ts"]': "src/untracked.ts",
  '["/repo","/repo/tests/example.test.js"]': "tests/example.test.js",
  '["/repo","/repo/tools/kept.ts"]': "tools/kept.ts",
  '["/repo","/repo/tsconfig.json"]': "tsconfig.json",
};

const PREPARED_DIRECTORY_LISTINGS: ReadonlyMap<string, ReturnType<DirectoryPort["list"]>> = new Map([
  ["/repo", { outcome: "ok", value: [
    { name: "src", kind: "directory" },
    { name: "tests", kind: "directory" },
    { name: "tools", kind: "directory" },
    { name: "tsconfig.json", kind: "file" },
  ] }],
  ["/repo/src", { outcome: "ok", value: [{ name: "untracked.ts", kind: "file" }] }],
  ["/repo/tests", { outcome: "ok", value: [{ name: "example.test.js", kind: "file" }] }],
  ["/repo/tools", { outcome: "ok", value: [
    { name: "core", kind: "directory" },
    { name: "kept.ts", kind: "file" },
  ] }],
]);


const RELATIVE_PATHS: Readonly<Record<string, string>> = {
  '["/repo","/install"]': "../install",
  '["/repo","/repo/src"]': "src",
  '["/repo","/repo/src/alpha.ts"]': "src/alpha.ts",
};
const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: ({ from, to }) => ({ relation: "within-root", path: requiredEntry({ table: RELATIVE_PATHS, key: JSON.stringify([from, to]) }) }),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};
const DIRECTORY_LISTINGS: ReadonlyMap<string, ReturnType<DirectoryPort["list"]>> = new Map([
  ["/repo", { outcome: "ok", value: [{ name: "src", kind: "directory" }] }],
  ["/repo/src", { outcome: "ok", value: [{ name: "alpha.ts", kind: "file" }] }],
]);
const walkerRunner = (request: {
  readonly read: FileTextPort["read"];
  readonly load: ModuleLoaderPort["load"];
  readonly parse: TypeScriptParsePort;
}) => createWalkerRunner({
  directory: { list: ({ path }) => DIRECTORY_LISTINGS.get(path) ?? assert.fail("unexpected directory") },
  fileText: { read: request.read, exists: () => "present", write: vi.fn<FileTextPort["write"]>() },
  modules: { load: request.load },
  path: TABLE_PATH,
  parse: request.parse,
});
const RUN_REQUEST = {
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  trackedPaths: [TRACKED_ONLY],
  clauses: [FIRST_CLAUSE],
};
const sourceCase = (request: { readonly name: string; readonly fileName: RepoPath; readonly source: string }): SourceCase =>
  ({ ...request, expectedLines: [] });
const pieceInvalid = {
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
};

describe("createWalkerRunner prepared population", () => {
  it("prepares a shared piece once over the filesystem union and reports applicable clean files per clause", async () => {
    const prepareFile = vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({ outcome: "ok", value: { kind: "complete", hits: [] } });
    const finish = vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] });
    const prepare = vi.fn<WalkerPiece["prepare"]>().mockReturnValue({ outcome: "ok", value: { prepareFile, finish } });
    const firstClause: RunnerClause = { ...FIRST_CLAUSE, pieceRoot: "/repo/tools/core/mechanisms/walker/XX-1" };
    const sharedClause: RunnerClause = { ...SECOND_CLAUSE, pieceRoot: "/repo/tools/core/mechanisms/walker/XX-1", settings: { module: "first.ts" } };
    const directory: DirectoryPort = { list: (request) => PREPARED_DIRECTORY_LISTINGS.get(request.path) ?? assert.fail("unexpected directory read") };
    const list = vi.spyOn(directory, "list");
    const read = vi.fn<FileTextPort["read"]>();
    const parse = parsingTo({ nodes: [] });
    const load = loadingNamespace({ namespace: { check: { prepare } } });
    const runner = createWalkerRunner({
      directory,
      fileText: { read, exists: () => "present", write: vi.fn<FileTextPort["write"]>() },
      modules: { load },
      path: {
        ...TABLE_PATH,
        relative: ({ from, to }) => ({ relation: "within-root", path: requiredEntry({ table: PREPARED_RELATIVE_PATHS, key: JSON.stringify([from, to]) }) }),
      },
      parse,
    });

    const returned = await runner.run({
      repoRoot: REPO_ROOT,
      installRoot: absolutePathSchema.parse("/repo/tools/core"),
      trackedPaths: [TRACKED_ONLY],
      clauses: [firstClause, sharedClause],
    });

    expect(returned).toEqual({
      outcome: "ok",
      value: {
        hits: [],
        evaluated: [
          { clause: FIRST_ADDRESS, files: expect.arrayContaining(["src/untracked.ts", "tests/example.test.js", "tools/kept.ts", "tsconfig.json"]) },
          { clause: SECOND_ADDRESS, files: expect.arrayContaining(["src/untracked.ts", "tests/example.test.js", "tools/kept.ts", "tsconfig.json"]) },
        ],
      },
    });
    expect(returned).toHaveProperty("value.evaluated.0.files.length", 4);
    expect(returned).toHaveProperty("value.evaluated.1.files.length", 4);
    expect(prepare).toHaveBeenCalledExactlyOnceWith({
      clauses: [firstClause, sharedClause],
      repository: {
        files: expect.arrayContaining(["src/untracked.ts", "tests/example.test.js", "tools/kept.ts", "tsconfig.json"]),
        exists: expect.any(Function),
      },
      syntaxApi: SYNTAX_API,
    });
    expect(prepare.mock.calls[0]?.[0].repository.files).toHaveLength(4);
    expect(load).toHaveBeenCalledExactlyOnceWith({ path: "/repo/tools/core/mechanisms/walker/XX-1/first.ts" });
    expect(list).toHaveBeenCalledTimes(4);
    expect(list.mock.calls).toEqual(expect.arrayContaining([
      [{ path: "/repo" }], [{ path: "/repo/src" }], [{ path: "/repo/tests" }], [{ path: "/repo/tools" }],
    ]));
    expect(prepareFile).toHaveBeenCalledTimes(4);
    expect(prepareFile.mock.calls).toEqual(expect.arrayContaining([
      [{ file: "src/untracked.ts", readText: expect.any(Function) }],
      [{ file: "tests/example.test.js", readText: expect.any(Function) }],
      [{ file: "tools/kept.ts", readText: expect.any(Function) }],
      [{ file: "tsconfig.json", readText: expect.any(Function) }],
    ]));
    expect(finish).toHaveBeenCalledExactlyOnceWith();
    expect(read).not.toHaveBeenCalled();
    expect(parse.parse).not.toHaveBeenCalled();
  });
});


describe("createWalkerRunner prepared composition", () => {
  it("retains file emissions before repository completion without position sorting", async () => {
    const prepareFile = vi.fn<PreparedWalkerCheck["prepareFile"]>().mockReturnValue({
      outcome: "ok", value: { kind: "complete", hits: [ALPHA_HIT] },
    });
    const finish = vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [FINISH_HIT] });
    const load = loadingNamespace({ namespace: { check: pieceWith({ prepared: { prepareFile, finish } }) } });
    const runner = walkerRunner({ read: readingText({ text: "" }), load, parse: parsingTo({ nodes: [] }) });

    expect(await runner.run(RUN_REQUEST)).toEqual({
      outcome: "ok",
      value: { hits: [ALPHA_HIT, FINISH_HIT], evaluated: [{ clause: FIRST_ADDRESS, files: [ALPHA] }] },
    });
    expect(load).toHaveBeenCalledExactlyOnceWith({ path: FIRST_MODULE });
    expect(prepareFile).toHaveBeenCalledExactlyOnceWith({ file: ALPHA, readText: expect.any(Function) });
    expect(finish).toHaveBeenCalledExactlyOnceWith();
    expect(prepareFile.mock.invocationCallOrder[0]).toBeLessThan(finish.mock.invocationCallOrder[0] ?? assert.fail("finish was not invoked"));
  });

  it("reads discovered files under the repository root and passes their names and text to the parser", async () => {
    const read = readingText({ text: "export const alpha = 1;" });
    const parse = parsingTo({ nodes: [] });
    const runner = walkerRunner({ read, parse, load: loadingNamespace({ namespace: { check: pieceWith({ prepared: SYNTAX_PREPARED }) } }) });

    expect(await runner.run(RUN_REQUEST)).toEqual({
      outcome: "ok", value: { hits: [], evaluated: [{ clause: FIRST_ADDRESS, files: [ALPHA] }] },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/src/alpha.ts" });
    expect(parse.parse).toHaveBeenCalledExactlyOnceWith({ fileName: ALPHA, source: "export const alpha = 1;" });
  });

  it("preserves the affected file and reader failure", async () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed", error: { kind: "unreadable", path: "/repo/src/alpha.ts", detail: "EACCES" },
    });
    const runner = walkerRunner({ read, parse: parsingTo({ nodes: [] }), load: loadingNamespace({ namespace: { check: pieceWith({ prepared: SYNTAX_PREPARED }) } }) });

    expect(await runner.run(RUN_REQUEST)).toEqual({
      outcome: "failed", error: { kind: "file-unreadable", file: ALPHA, detail: "EACCES" },
    });
  });

  it("attributes an external parser failure to the discovered file", async () => {
    const parse: TypeScriptParsePort = { ...parsingTo({ nodes: [] }), parse: () => assert.fail("parser crashed") };
    const runner = walkerRunner({ read: readingText({ text: "" }), parse, load: loadingNamespace({ namespace: { check: pieceWith({ prepared: SYNTAX_PREPARED }) } }) });

    expect(await runner.run(RUN_REQUEST)).toEqual({
      outcome: "failed", error: { kind: "file-unparseable", file: ALPHA, detail: "parser crashed" },
    });
  });
});

describe("createWalkerRunner preparation failures", () => {
  it("refuses invalid settings before loading a module", async () => {
    const load = loadingNamespace({ namespace: { check: pieceWith({ prepared: EMPTY_PREPARED }) } });
    const runner = walkerRunner({ read: readingText({ text: "" }), load, parse: parsingTo({ nodes: [] }) });

    expect(await runner.run({ ...RUN_REQUEST, clauses: [clauseFor({ address: FIRST_ADDRESS, settings: {} })] })).toEqual(pieceInvalid);
    expect(load).not.toHaveBeenCalled();
  });

  it("preserves module admission and loading failures", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>()
      .mockResolvedValueOnce({ outcome: "ok", value: {} })
      .mockResolvedValueOnce({ outcome: "failed", error: { kind: "module-unloadable", path: FIRST_MODULE, detail: "SyntaxError" } });
    const runner = walkerRunner({ read: readingText({ text: "" }), load, parse: parsingTo({ nodes: [] }) });

    expect(await runner.run(RUN_REQUEST)).toEqual(pieceInvalid);
    expect(await runner.run(RUN_REQUEST)).toEqual(pieceInvalid);
  });
});

describe("createWalkerRunner isolated conformance", () => {
  it("uses each case's supplied source and filename without reading disk", async () => {
    const read = vi.fn<FileTextPort["read"]>();
    const parse = parsingTo({ nodes: [] });
    const runner = walkerRunner({ read, parse, load: loadingNamespace({ namespace: { check: pieceWith({ prepared: SYNTAX_PREPARED }) } }) });

    expect(await runner.conform({ clause: FIRST_CLAUSE, cases: [
      sourceCase({ name: "first", fileName: ALPHA, source: "first source" }),
      sourceCase({ name: "second", fileName: BETA, source: "second source" }),
    ] })).toEqual({ outcome: "ok", value: [
      { caseName: "first", flaggedLines: [] }, { caseName: "second", flaggedLines: [] },
    ] });
    expect(parse.parse.mock.calls).toEqual([
      [{ fileName: ALPHA, source: "first source" }], [{ fileName: BETA, source: "second source" }],
    ]);
    expect(read).not.toHaveBeenCalled();
  });

  it("isolates preparation and repository completion for alternatives sharing a filename", async () => {
    const firstFinish = vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [ALPHA_HIT, ALPHA_HIT] });
    const secondFinish = vi.fn<PreparedWalkerCheck["finish"]>().mockReturnValue({ outcome: "ok", value: [] });
    const prepare = vi.fn<WalkerPiece["prepare"]>()
      .mockReturnValueOnce({ outcome: "ok", value: { ...EMPTY_PREPARED, finish: firstFinish } })
      .mockReturnValueOnce({ outcome: "ok", value: { ...EMPTY_PREPARED, finish: secondFinish } });
    const runner = walkerRunner({ read: vi.fn<FileTextPort["read"]>(), parse: parsingTo({ nodes: [] }), load: loadingNamespace({ namespace: { check: { prepare } } }) });

    expect(await runner.conform({ clause: FIRST_CLAUSE, cases: [
      sourceCase({ name: "violating", fileName: ALPHA, source: "first" }),
      sourceCase({ name: "clean", fileName: ALPHA, source: "second" }),
    ] })).toEqual({ outcome: "ok", value: [
      { caseName: "violating", flaggedLines: [9] }, { caseName: "clean", flaggedLines: [] },
    ] });
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(firstFinish).toHaveBeenCalledExactlyOnceWith();
    expect(secondFinish).toHaveBeenCalledExactlyOnceWith();
  });

  it("refuses a repository finish hit naming a different file from the conformance case", async () => {
    const prepared: PreparedWalkerCheck = {
      ...EMPTY_PREPARED,
      finish: () => ({ outcome: "ok", value: [{ ...ALPHA_HIT, file: BETA }] }),
    };
    const runner = walkerRunner({ read: vi.fn<FileTextPort["read"]>(), parse: parsingTo({ nodes: [] }), load: loadingNamespace({ namespace: { check: pieceWith({ prepared }) } }) });

    expect(await runner.conform({ clause: FIRST_CLAUSE, cases: [
      sourceCase({ name: "alpha only", fileName: ALPHA, source: "" }),
    ] })).toEqual(pieceInvalid);
  });
});
