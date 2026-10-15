import { describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import type { AnchorKind } from "../../../core/values/anchor.ts";
import { type ClauseAddress, clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import type { ParsePort, WalkerCheck } from "./walker-check.ts";

type FakeNode = {
  readonly label: string;
  readonly position: number;
  readonly children: readonly FakeNode[];
};

type FakeTree = { readonly label: "root"; readonly children: readonly FakeNode[] };

type FakeCheck = WalkerCheck<"fake-api", FakeTree, FakeNode>;
type FakeSyntaxInspect = Extract<FakeCheck, { readonly kind: "syntax" }>["inspect"];
type FakeParse = ParsePort<"fake-api", FakeTree, FakeNode>["parse"];

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const PIECE_ROOT = "/install/mechanisms/walker/XX-1";
const FIRST_MODULE = "/install/mechanisms/walker/XX-1/first.ts";
const SECOND_MODULE = "/install/mechanisms/walker/XX-1/second.ts";

const ALPHA = repoPathSchema.parse("src/alpha.ts");
const BETA = repoPathSchema.parse("src/beta.ts");
const DECLARATIONS = repoPathSchema.parse("src/types.d.ts");
const TRACKED_ONLY = repoPathSchema.parse("src/tracked-only.ts");

const FIRST_ADDRESS = clauseAddressSchema.parse("XX-1#first-check");
const SECOND_ADDRESS = clauseAddressSchema.parse("XX-1#second-check");
const KEYWORD_ANCHOR: AnchorKind = { kind: "keyword", keyword: "class" };

const CLASS_ON_LINE_THREE = "const a = 1;\n\n  class Alpha {}\n";
const CLASS_KEYWORD_ON_LINE_THREE = 16;

const LEAF: FakeNode = { label: "leaf", position: 0, children: [] };
const INNER: FakeNode = { label: "inner", position: 0, children: [] };
const OUTER: FakeNode = { label: "outer", position: 0, children: [INNER] };

const TWO_CLASSES = "class Abc {}\n\n  class Def {}\n";
const FIRST_CLASS_NODE: FakeNode = { label: "first class", position: 0, children: [] };
const SECOND_CLASS_NODE: FakeNode = { label: "second class", position: 16, children: [] };

const readingText = (request: { readonly text: string }) =>
  vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text });

const unreadable = () =>
  vi.fn<FileTextPort["read"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "unreadable", path: "/repo/src/alpha.ts", detail: "EACCES" },
  });

const loadingNamespace = (request: { readonly namespace: unknown }) =>
  vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: request.namespace });

const unloadable = () =>
  vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
    outcome: "failed",
    error: { kind: "module-unloadable", path: FIRST_MODULE, detail: "SyntaxError" },
  });

const parsingTo = (request: { readonly nodes: readonly FakeNode[] }) =>
  vi.fn<FakeParse>().mockReturnValue({ label: "root", children: request.nodes });

const anchorEveryNode: FakeSyntaxInspect = (inspectRequest) => [
  inspectRequest.anchorAt({ position: inspectRequest.node.position }),
];

const anchorAtPosition =
  (request: { readonly position: number }): FakeSyntaxInspect =>
  (inspectRequest) => [inspectRequest.anchorAt({ position: request.position })];

const recordingInspect =() => vi.fn<FakeSyntaxInspect>().mockReturnValue([]);

const syntaxCheck = (request: { readonly inspect: FakeSyntaxInspect }): FakeCheck => ({
  kind: "syntax",
  inspect: request.inspect,
});

const VIOLATING_PATH_CHECK: FakeCheck = { kind: "path", inspect: () => "violates" };
const CONFORMING_PATH_CHECK: FakeCheck = { kind: "path", inspect: () => "conforms" };

const clauseFor = (request: {
  readonly address: ClauseAddress;
  readonly settings: unknown;
}): RunnerClause => ({
  address: request.address,
  anchor: KEYWORD_ANCHOR,
  pieceRoot: PIECE_ROOT,
  settings: request.settings,
});

const FIRST_CLAUSE = clauseFor({ address: FIRST_ADDRESS, settings: { module: "first.ts" } });
const SECOND_CLAUSE = clauseFor({ address: SECOND_ADDRESS, settings: { module: "second.ts" } });

const walkerRunner = (request: {
  readonly read: FileTextPort["read"];
  readonly load: ModuleLoaderPort["load"];
  readonly parse: FakeParse;
}) =>
  createWalkerRunner<"fake-api", FakeTree, FakeNode>({
    fileText: {
      read: request.read,
      exists: () => "present",
      write: () => ({ outcome: "ok", value: undefined }),
    },
    modules: { load: request.load },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" }),
    parse: {
      syntaxApi: "fake-api",
      parse: request.parse,
      children: (childRequest) => childRequest.node.children,
    },
  });

const runRequest = (request: {
  readonly files: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
}) => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  files: request.files,
  trackedPaths: [TRACKED_ONLY],
  clauses: request.clauses,
});

const sourceCase = (request: {
  readonly name: string;
  readonly fileName: RepoPath;
  readonly source: string;
}): SourceCase => ({ ...request, expectedLines: [] });

const pieceInvalid = {
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
};

describe("createWalkerRunner run", () => {
  it("reports a hit at the line, column and trimmed line text of the position a syntax check anchors", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({
        namespace: {
          check: syntaxCheck({
            inspect: anchorAtPosition({ position: CLASS_KEYWORD_ON_LINE_THREE }),
          }),
        },
      }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual({
      outcome: "ok",
      value: [
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class Alpha {}",
        },
      ],
    });
  });

  it("reads each file under the repository root", async () => {
    const read = readingText({ text: CLASS_ON_LINE_THREE });
    const runner = walkerRunner({
      read,
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    await runner.run(runRequest({ files: [ALPHA, BETA], clauses: [FIRST_CLAUSE] }));

    expect(read.mock.calls).toEqual([
      [{ path: "/repo/src/alpha.ts" }],
      [{ path: "/repo/src/beta.ts" }],
    ]);
  });

  it("parses each file once under its repository path however many syntax checks are selected", async () => {
    const parse = parsingTo({ nodes: [LEAF] });
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse,
    });

    await runner.run(
      runRequest({ files: [ALPHA, BETA], clauses: [FIRST_CLAUSE, SECOND_CLAUSE] }),
    );

    expect(parse.mock.calls).toEqual([
      [{ fileName: "src/alpha.ts", source: CLASS_ON_LINE_THREE }],
      [{ fileName: "src/beta.ts", source: CLASS_ON_LINE_THREE }],
    ]);
  });

  it("offers each node of each file to every selected syntax check", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(
      await runner.run(
        runRequest({ files: [ALPHA, BETA], clauses: [FIRST_CLAUSE, SECOND_CLAUSE] }),
      ),
    ).toEqual({
      outcome: "ok",
      value: expect.arrayContaining([
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 1, column: 0 },
          snippet: "const a = 1;",
        },
        {
          clause: SECOND_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 1, column: 0 },
          snippet: "const a = 1;",
        },
        {
          clause: FIRST_ADDRESS,
          file: "src/beta.ts",
          anchor: { line: 1, column: 0 },
          snippet: "const a = 1;",
        },
        {
          clause: SECOND_ADDRESS,
          file: "src/beta.ts",
          anchor: { line: 1, column: 0 },
          snippet: "const a = 1;",
        },
      ]),
    });
  });

  it("neither reads nor parses a declaration file", async () => {
    const read = readingText({ text: CLASS_ON_LINE_THREE });
    const parse = parsingTo({ nodes: [LEAF] });
    const runner = walkerRunner({
      read,
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse,
    });

    await runner.run(runRequest({ files: [ALPHA, DECLARATIONS], clauses: [FIRST_CLAUSE] }));

    expect({ reads: read.mock.calls, parses: parse.mock.calls }).toEqual({
      reads: [[{ path: "/repo/src/alpha.ts" }]],
      parses: [[{ fileName: "src/alpha.ts", source: CLASS_ON_LINE_THREE }]],
    });
  });

  it("orders a file's hits by position, then by clause order at the same position", async () => {
    const runner = walkerRunner({
      read: readingText({ text: TWO_CLASSES }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: parsingTo({ nodes: [FIRST_CLASS_NODE, SECOND_CLASS_NODE] }),
    });

    expect(
      await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE, SECOND_CLAUSE] })),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 1, column: 0 },
          snippet: "class Abc {}",
        },
        {
          clause: SECOND_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 1, column: 0 },
          snippet: "class Abc {}",
        },
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class Def {}",
        },
        {
          clause: SECOND_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class Def {}",
        },
      ],
    });
  });

  it("offers a nested node by recursing through children", async () => {
    const inspect = recordingInspect();
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect }) } }),
      parse: parsingTo({ nodes: [OUTER] }),
    });

    await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }));

    expect(inspect).toHaveBeenCalledWith(expect.objectContaining({ node: INNER }));
  });

  it("hands a syntax check the node, its tree, the port's syntax API and the clause's anchor kind", async () => {
    const inspect = recordingInspect();
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect }) } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }));

    expect(inspect.mock.calls).toEqual([
      [
        {
          node: LEAF,
          tree: { label: "root", children: [LEAF] },
          syntaxApi: "fake-api",
          anchorKind: { kind: "keyword", keyword: "class" },
          anchorAt: expect.any(Function),
        },
      ],
    ]);
  });

  it("offers every file, declaration files included, to a path check and none of the tracked paths", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: VIOLATING_PATH_CHECK } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(
      await runner.run(runRequest({ files: [ALPHA, DECLARATIONS], clauses: [FIRST_CLAUSE] })),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 1, column: 0 },
          snippet: "src/alpha.ts",
        },
        {
          clause: FIRST_ADDRESS,
          file: "src/types.d.ts",
          anchor: { line: 1, column: 0 },
          snippet: "src/types.d.ts",
        },
      ],
    });
  });

  it("neither reads nor parses a file when only path checks are selected", async () => {
    const read = readingText({ text: CLASS_ON_LINE_THREE });
    const parse = parsingTo({ nodes: [LEAF] });
    const runner = walkerRunner({
      read,
      load: loadingNamespace({ namespace: { check: VIOLATING_PATH_CHECK } }),
      parse,
    });

    await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }));

    expect({ reads: read.mock.calls, parses: parse.mock.calls }).toEqual({
      reads: [],
      parses: [],
    });
  });

  it("reports no hit for a file a path check finds conforming", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: CONFORMING_PATH_CHECK } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  it("loads each piece module from its piece folder", async () => {
    const load = loadingNamespace({
      namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) },
    });
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load,
      parse: parsingTo({ nodes: [LEAF] }),
    });

    await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE, SECOND_CLAUSE] }));

    expect(load.mock.calls).toEqual([[{ path: FIRST_MODULE }], [{ path: SECOND_MODULE }]]);
  });

  it("loads a piece module two clauses name once", async () => {
    const load = loadingNamespace({
      namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) },
    });
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load,
      parse: parsingTo({ nodes: [LEAF] }),
    });

    await runner.run(
      runRequest({
        files: [ALPHA],
        clauses: [
          FIRST_CLAUSE,
          clauseFor({ address: SECOND_ADDRESS, settings: { module: "first.ts" } }),
        ],
      }),
    );

    expect(load.mock.calls).toEqual([[{ path: FIRST_MODULE }]]);
  });

  it("is file-unreadable with the file and the port's detail when a file cannot be read", async () => {
    const runner = walkerRunner({
      read: unreadable(),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "src/alpha.ts", detail: "EACCES" },
    });
  });

  it("is file-unparseable with the file and the thrown message when the parse port throws", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: vi.fn<FakeParse>().mockThrow(new Error("parser crashed")),
    });

    await expect(runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/alpha.ts", detail: "parser crashed" },
    });
  });
});

describe("createWalkerRunner anchorAt", () => {
  it("ends a line at a carriage return line feed", async () => {
    const runner = walkerRunner({
      read: readingText({ text: "first\r\nsecond\r\n  class X {}" }),
      load: loadingNamespace({
        namespace: { check: syntaxCheck({ inspect: anchorAtPosition({ position: 17 }) }) },
      }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual({
      outcome: "ok",
      value: [
        {
          clause: FIRST_ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class X {}",
        },
      ],
    });
  });
});

describe("createWalkerRunner piece failures", () => {
  it.each([
    { name: "no module", settings: {} },
  ])("is piece-invalid for settings with $name, loading nothing", async ({ settings }) => {
    const load = loadingNamespace({
      namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) },
    });
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load,
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect({
      result: await runner.run(
        runRequest({ files: [ALPHA], clauses: [clauseFor({ address: FIRST_ADDRESS, settings })] }),
      ),
      loads: load.mock.calls,
    }).toEqual({ result: pieceInvalid, loads: [] });
  });

  it.each([
    { name: "no check export", namespace: {} },
  ])("is piece-invalid for a piece module with $name", async ({ namespace }) => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual(
      pieceInvalid,
    );
  });

  it("is piece-invalid when the piece module cannot be loaded", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: unloadable(),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual(
      pieceInvalid,
    );
  });

  it("is piece-invalid when a syntax check throws", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({
        namespace: {
          check: syntaxCheck({
            inspect: vi.fn<FakeSyntaxInspect>().mockThrow(new Error("the check threw")),
          }),
        },
      }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual(
      pieceInvalid,
    );
  });

  it.each([
    {
      name: "a syntax check returning a promise that rejects",
      check: {
        kind: "syntax",
        inspect: vi.fn().mockRejectedValue(new Error("the check rejected")),
      },
    },
  ])("is piece-invalid for $name", async ({ check }) => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(await runner.run(runRequest({ files: [ALPHA], clauses: [FIRST_CLAUSE] }))).toEqual(
      pieceInvalid,
    );
  });
});

describe("createWalkerRunner conform", () => {
  it("returns each case's flagged lines in case order, skipping a declaration file", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse: parsingTo({
        nodes: [
          { label: "first", position: 0, children: [] },
          { label: "second", position: 2, children: [] },
        ],
      }),
    });

    expect(
      await runner.conform({
        clause: FIRST_CLAUSE,
        cases: [
          sourceCase({ name: "two lines", fileName: ALPHA, source: "a\nb\n" }),
          sourceCase({ name: "declaration file", fileName: DECLARATIONS, source: "a\nb\n" }),
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { caseName: "two lines", flaggedLines: [1, 2] },
        { caseName: "declaration file", flaggedLines: [] },
      ],
    });
  });

  it("parses each case's source under its file name and reads no file", async () => {
    const read = readingText({ text: CLASS_ON_LINE_THREE });
    const parse = parsingTo({ nodes: [LEAF] });
    const runner = walkerRunner({
      read,
      load: loadingNamespace({ namespace: { check: syntaxCheck({ inspect: anchorEveryNode }) } }),
      parse,
    });

    await runner.conform({
      clause: FIRST_CLAUSE,
      cases: [sourceCase({ name: "one line", fileName: BETA, source: "class Beta {}\n" })],
    });

    expect({ reads: read.mock.calls, parses: parse.mock.calls }).toEqual({
      reads: [],
      parses: [[{ fileName: "src/beta.ts", source: "class Beta {}\n" }]],
    });
  });

  it("flags line 1 of a case a path check finds violating", async () => {
    const runner = walkerRunner({
      read: readingText({ text: CLASS_ON_LINE_THREE }),
      load: loadingNamespace({ namespace: { check: VIOLATING_PATH_CHECK } }),
      parse: parsingTo({ nodes: [LEAF] }),
    });

    expect(
      await runner.conform({
        clause: FIRST_CLAUSE,
        cases: [sourceCase({ name: "declaration file", fileName: DECLARATIONS, source: "" })],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: "declaration file", flaggedLines: [1] }] });
  });
});
