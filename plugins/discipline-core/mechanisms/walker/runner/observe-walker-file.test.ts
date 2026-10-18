import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { observeWalkerFile } from "./observe-walker-file.ts";
import type {
  LoadedPreparedWalkerCheck,
  PreparedWalkerPiece,
} from "./prepare-walker-pieces.ts";
import {
  createDefaultParsePort,
  type CommentRange,
  type SyntaxNode,
  type SyntaxTree,
  type TypeScriptParsePort,
} from "./typescript-parse.ts";
import type { PieceHit, SourceObservers, WalkerFile } from "./walker-piece.ts";

const FILE = repoPathSchema.parse("src/example.tsx");
const SOURCE = "{ { /* note */ } }\n";
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const TREE = SYNTAX_API.createSourceFile(FILE, SOURCE, SYNTAX_API.ScriptTarget.Latest, true);
const OUTER_BLOCK = TREE.getChildAt(0, TREE).getChildAt(0, TREE);
const INNER_BLOCK = OUTER_BLOCK.getChildAt(1, TREE).getChildAt(0, TREE);

const FIRST_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#first-check"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/XX-1",
  settings: { module: "first.ts" },
};
const SECOND_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#second-check"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/XX-1",
  settings: { module: "second.ts" },
};
const THIRD_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("XX-1#third-check"),
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/XX-1",
  settings: { module: "third.ts" },
};
const FIRST_HIT: PieceHit = {
  clause: FIRST_CLAUSE.address,
  anchor: { line: 1, column: 2 },
  snippet: "first",
};
const SECOND_HIT: PieceHit = {
  clause: SECOND_CLAUSE.address,
  anchor: { line: 1, column: 4 },
  snippet: "second",
};
const THIRD_HIT: PieceHit = {
  clause: THIRD_CLAUSE.address,
  anchor: { line: 1, column: 15 },
  snippet: "third",
};

const preparedPiece = (request: {
  readonly modulePath: string;
  readonly clauses: readonly RunnerClause[];
  readonly prepareFile: LoadedPreparedWalkerCheck["prepareFile"];
}): PreparedWalkerPiece => ({
  modulePath: request.modulePath,
  clauses: request.clauses,
  check: {
    prepareFile: request.prepareFile,
    finish: vi.fn().mockReturnValue({ outcome: "ok", value: [] }),
  },
});

const parseFixture = (): TypeScriptParsePort => ({
  syntaxApi: SYNTAX_API,
  parse: vi.fn<TypeScriptParsePort["parse"]>().mockReturnValue(TREE),
  children: vi.fn<TypeScriptParsePort["children"]>()
    .mockReturnValueOnce([OUTER_BLOCK, TREE.endOfFileToken])
    .mockReturnValueOnce([INNER_BLOCK])
    .mockReturnValue([]),
});

type ObserverEvent =
  | { readonly piece: string; readonly phase: "enter" | "leave"; readonly node: SyntaxNode }
  | { readonly piece: string; readonly phase: "comment"; readonly range: CommentRange }
  | { readonly piece: string; readonly phase: "finish" };

const recordingObservers = (request: {
  readonly label: string;
  readonly observe: (event: ObserverEvent) => void;
  readonly hits: readonly PieceHit[];
}): SourceObservers => ({
  enter: ({ node }) => {
    request.observe({ piece: request.label, phase: "enter", node });
  },
  leave: ({ node }) => {
    request.observe({ piece: request.label, phase: "leave", node });
  },
  comment: ({ range }) => {
    request.observe({ piece: request.label, phase: "comment", range });
  },
  finish: () => {
    request.observe({ piece: request.label, phase: "finish" });
    return request.hits;
  },
});

const documentedSourceFixture = (): {
  readonly source: string;
  readonly tree: SyntaxTree;
  readonly statement: SyntaxNode;
  readonly declarations: SyntaxNode;
  readonly declaration: SyntaxNode;
  readonly identifier: SyntaxNode;
  readonly objectLiteral: SyntaxNode;
  readonly parse: TypeScriptParsePort;
} => {
  const source = "/** @type {{ flag: boolean }} */\r\nconst value = {};\r\n";
  const tree = SYNTAX_API.createSourceFile(FILE, source, SYNTAX_API.ScriptTarget.Latest, true);
  const statement = tree.getChildAt(0, tree).getChildAt(0, tree);
  const declarations = statement.getChildAt(1, tree);
  const declaration = declarations.getChildAt(1, tree).getChildAt(0, tree);
  const identifier = declaration.getChildAt(0, tree);
  const objectLiteral = declaration.getChildAt(2, tree);
  const children = new Map<SyntaxNode, readonly SyntaxNode[]>([
    [tree, [statement, tree.endOfFileToken]],
    [statement, [declarations]],
    [declarations, [declaration]],
    [declaration, [identifier, objectLiteral]],
  ]);
  return {
    source,
    tree,
    statement,
    declarations,
    declaration,
    identifier,
    objectLiteral,
    parse: {
      syntaxApi: SYNTAX_API,
      parse: vi.fn().mockReturnValue(tree),
      children: ({ node }) => children.get(node) ?? [],
    },
  };
};

describe("observeWalkerFile", () => {
  it("completes path-only pieces and skips ineligible pieces without reading or parsing input", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "unexpected read" },
    });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({ outcome: "ok", value: { kind: "complete", hits: [FIRST_HIT] } }),
    });
    const skipped = preparedPiece({
      modulePath: "second.ts",
      clauses: [SECOND_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first, skipped], parse });

    expect(observed).toEqual({
      outcome: "ok",
      value: { hits: [{ ...FIRST_HIT, file: FILE }], applicable: [FIRST_CLAUSE.address] },
    });
    expect(readText).not.toHaveBeenCalled();
    expect(parse.parse).not.toHaveBeenCalled();
    expect(parse.children).not.toHaveBeenCalled();
  });

  it("preserves an explicit prepareFile failure without reading or beginning syntax", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const begin = vi.fn().mockReturnValue({ finish: () => [] });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "team-config-unloadable", detail: "invalid piece configuration" },
      }),
    });
    const second = preparedPiece({
      modulePath: "second.ts",
      clauses: [SECOND_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({ outcome: "ok", value: { kind: "syntax", begin } }),
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first, second], parse });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: "invalid piece configuration" },
    });
    expect(readText).not.toHaveBeenCalled();
    expect(parse.parse).not.toHaveBeenCalled();
    expect(begin).not.toHaveBeenCalled();
  });

  it("reuses text across complete pieces, excludes skipped clauses and emits every complete hit without parsing", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "ok",
      value: SOURCE,
    });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE, SECOND_CLAUSE],
      prepareFile: ({ readText: read }) => {
        read();
        read();
        return { outcome: "ok", value: { kind: "complete", hits: [FIRST_HIT, SECOND_HIT] } };
      },
    });
    const skipped = preparedPiece({
      modulePath: "skipped.ts",
      clauses: [SECOND_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({ outcome: "ok", value: { kind: "skipped" } }),
    });
    const third = preparedPiece({
      modulePath: "third.ts",
      clauses: [THIRD_CLAUSE],
      prepareFile: ({ readText: read }) => {
        read();
        return { outcome: "ok", value: { kind: "complete", hits: [THIRD_HIT] } };
      },
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first, skipped, third], parse });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
          { ...FIRST_HIT, file: FILE },
          { ...SECOND_HIT, file: FILE },
          { ...THIRD_HIT, file: FILE },
        ],
        applicable: [FIRST_CLAUSE.address, SECOND_CLAUSE.address, THIRD_CLAUSE.address],
      },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse.parse).not.toHaveBeenCalled();
    expect(parse.children).not.toHaveBeenCalled();
    expect(skipped.check.prepareFile).toHaveBeenCalledTimes(1);
    expect(first.check.finish).not.toHaveBeenCalled();
    expect(third.check.finish).not.toHaveBeenCalled();
  });

  it("shares one parse and nested semantic observation stream, deduplicates comments and finishes sources before assembling piece-ordered hits", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const observe = vi.fn<(event: ObserverEvent) => void>();
    const recordAnchor = vi.fn<(anchor: Anchor) => void>();
    const recordSource = vi.fn<(request: { readonly sourceFile: SyntaxTree }) => void>();
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: () => ({
        outcome: "ok",
        value: {
          kind: "syntax",
          begin: ({ sourceFile, anchorAt }: {
            readonly sourceFile: SyntaxTree;
            readonly anchorAt: (request: { readonly position: number }) => Anchor;
          }) => {
            recordSource({ sourceFile });
            recordAnchor(anchorAt({ position: 15 }));
            return recordingObservers({ label: "first", observe, hits: [FIRST_HIT] });
          },
        },
      }),
    });
    const complete = preparedPiece({
      modulePath: "second.ts",
      clauses: [SECOND_CLAUSE],
      prepareFile: vi.fn().mockReturnValue({ outcome: "ok", value: { kind: "complete", hits: [SECOND_HIT] } }),
    });
    const third = preparedPiece({
      modulePath: "third.ts",
      clauses: [THIRD_CLAUSE],
      prepareFile: () => ({
        outcome: "ok",
        value: {
          kind: "syntax",
          begin: () => recordingObservers({ label: "third", observe, hits: [THIRD_HIT] }),
        },
      }),
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first, complete, third], parse });

    expect(observed).toEqual({
      outcome: "ok",
      value: {
        hits: [
          { ...FIRST_HIT, file: FILE },
          { ...SECOND_HIT, file: FILE },
          { ...THIRD_HIT, file: FILE },
        ],
        applicable: [FIRST_CLAUSE.address, SECOND_CLAUSE.address, THIRD_CLAUSE.address],
      },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse.parse).toHaveBeenCalledExactlyOnceWith({ fileName: FILE, source: SOURCE });
    expect(recordSource.mock.calls).toEqual([[{ sourceFile: TREE }]]);
    expect(recordAnchor.mock.calls).toEqual([[{ line: 1, column: 15 }]]);
    expect(observe.mock.calls).toEqual([
      [{ piece: "first", phase: "enter", node: TREE }],
      [{ piece: "third", phase: "enter", node: TREE }],
      [{ piece: "first", phase: "enter", node: OUTER_BLOCK }],
      [{ piece: "third", phase: "enter", node: OUTER_BLOCK }],
      [{ piece: "first", phase: "enter", node: INNER_BLOCK }],
      [{ piece: "third", phase: "enter", node: INNER_BLOCK }],
      [{ piece: "first", phase: "comment", range: expect.objectContaining({ pos: 4, end: 14 }) }],
      [{ piece: "third", phase: "comment", range: expect.objectContaining({ pos: 4, end: 14 }) }],
      [{ piece: "first", phase: "leave", node: INNER_BLOCK }],
      [{ piece: "third", phase: "leave", node: INNER_BLOCK }],
      [{ piece: "first", phase: "leave", node: OUTER_BLOCK }],
      [{ piece: "third", phase: "leave", node: OUTER_BLOCK }],
      [{ piece: "first", phase: "enter", node: TREE.endOfFileToken }],
      [{ piece: "third", phase: "enter", node: TREE.endOfFileToken }],
      [{ piece: "first", phase: "leave", node: TREE.endOfFileToken }],
      [{ piece: "third", phase: "leave", node: TREE.endOfFileToken }],
      [{ piece: "first", phase: "leave", node: TREE }],
      [{ piece: "third", phase: "leave", node: TREE }],
      [{ piece: "first", phase: "finish" }],
      [{ piece: "third", phase: "finish" }],
    ]);
    expect(first.check.finish).not.toHaveBeenCalled();
    expect(third.check.finish).not.toHaveBeenCalled();
  });

  it("caches a failed text read and returns its affected-input failure before parsing or beginning syntax", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
    const begin = vi.fn().mockReturnValue({ finish: () => [] });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: ({ readText: read }) => {
        read();
        read();
        return { outcome: "ok", value: { kind: "syntax", begin } };
      },
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse.parse).not.toHaveBeenCalled();
    expect(begin).not.toHaveBeenCalled();
    expect(first.check.finish).not.toHaveBeenCalled();
  });

  it.each([
    {
      boundary: "prepareFile",
      prepareFile: () => ({ outcome: "ok", value: { kind: "unknown" } }),
    },
    {
      boundary: "begin",
      prepareFile: () => ({
        outcome: "ok",
        value: { kind: "syntax", begin: () => ({ finish: "finish" }) },
      }),
    },
    {
      boundary: "source finish",
      prepareFile: () => ({
        outcome: "ok",
        value: { kind: "syntax", begin: () => ({ finish: () => ({ hits: [] }) }) },
      }),
    },
  ])("refuses malformed actual output from $boundary as piece-invalid", ({ prepareFile }) => {
    const first = preparedPiece({ modulePath: "first.ts", clauses: [FIRST_CLAUSE], prepareFile });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse: parseFixture() });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: FIRST_CLAUSE.pieceRoot, detail: expect.any(String) },
    });
  });

  it("attributes a thrown observer to its piece and does not publish source completion", () => {
    const finish = vi.fn().mockReturnValue([FIRST_HIT]);
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: () => ({
        outcome: "ok",
        value: {
          kind: "syntax",
          begin: () => ({
            enter: () => assert.fail("observer failed"),
            finish,
          }),
        },
      }),
    });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse: parseFixture() });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: FIRST_CLAUSE.pieceRoot, detail: "observer failed" },
    });
    expect(finish).not.toHaveBeenCalled();
  });

  it("attributes a parser failure to the affected file before beginning any source observer", () => {
    const begin = vi.fn().mockReturnValue({ finish: () => [] });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: () => ({ outcome: "ok", value: { kind: "syntax", begin } }),
    });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });
    const parse: TypeScriptParsePort = {
      ...parseFixture(),
      parse: () => assert.fail("parser failed"),
    };

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: FILE, detail: "parser failed" },
    });
    expect(begin).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "complete", completion: { kind: "complete", hits: [FIRST_HIT] } },
    { kind: "skipped", completion: { kind: "skipped" } },
  ])("refuses an ignored requested read failure even when a piece returns successful $kind", ({ completion }) => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: ({ readText: read }) => {
        read();
        return { outcome: "ok", value: completion };
      },
    });
    const parse = parseFixture();

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: FILE, detail: "EACCES" },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(parse.parse).not.toHaveBeenCalled();
  });

  it("refuses a piece emitting another selected piece's clause", () => {
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: () => ({ outcome: "ok", value: { kind: "complete", hits: [SECOND_HIT] } }),
    });
    const second = preparedPiece({
      modulePath: "second.ts",
      clauses: [SECOND_CLAUSE],
      prepareFile: () => ({ outcome: "ok", value: { kind: "complete", hits: [] } }),
    });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: SOURCE });

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first, second], parse: parseFixture() });

    expect(observed).toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: FIRST_CLAUSE.pieceRoot, detail: expect.any(String) },
    });
  });

  it("keeps JSDoc-only descendants outside semantic callbacks and supplies one-based anchors across CRLF", () => {
    const fixture = documentedSourceFixture();
    const enter = vi.fn<NonNullable<SourceObservers["enter"]>>();
    const recordAnchor = vi.fn<(anchor: Anchor) => void>();
    const first = preparedPiece({
      modulePath: "first.ts",
      clauses: [FIRST_CLAUSE],
      prepareFile: () => ({
        outcome: "ok",
        value: {
          kind: "syntax",
          begin: ({ anchorAt }: {
            readonly anchorAt: (request: { readonly position: number }) => Anchor;
          }) => {
            recordAnchor(anchorAt({ position: 40 }));
            return {
              enter,
              finish: () => [],
            };
          },
        },
      }),
    });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: fixture.source });

    const observed = observeWalkerFile({ file: { file: FILE, readText }, pieces: [first], parse: fixture.parse });

    expect(observed).toEqual({ outcome: "ok", value: { hits: [], applicable: [FIRST_CLAUSE.address] } });
    expect(recordAnchor.mock.calls).toEqual([[{ line: 2, column: 6 }]]);
    expect(enter.mock.calls).toEqual([
      [{ node: fixture.tree }],
      [{ node: fixture.statement }],
      [{ node: fixture.declarations }],
      [{ node: fixture.declaration }],
      [{ node: fixture.identifier }],
      [{ node: fixture.objectLiteral }],
      [{ node: fixture.tree.endOfFileToken }],
    ]);
  });
});
