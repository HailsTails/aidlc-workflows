import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../runner/walker-piece.ts";
import { check } from "./comments-directives.ts";

const FILE = repoPathSchema.parse("src/annotations.ts");
const ADDRESS = clauseAddressSchema.parse("CD-5#comments-directives");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const TODO_ANNOTATION = "TO" + "DO";
const TYPE_EXPECTATION = "@ts-expect-" + "error";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-5",
  settings: { module: "comments-directives.ts" },
};

const sourceObservations = (request: { readonly source: string }): {
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [FILE], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({ file: FILE, readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }) });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 7, column: 2 });
  return {
    observers: selected.value.begin({ sourceFile: SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true), anchorAt }),
    anchorAt,
    finish: prepared.value.finish,
  };
};

describe("CD-5 existing annotation capability", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/node_modules/example.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/example.test.ts", kind: "syntax" },
    { name: "declaration source", fileName: "src/example.d.ts", kind: "syntax" },
    { name: "physical scripts source", fileName: "scripts/task.ts", kind: "syntax" },
    { name: "non-TypeScript candidate", fileName: "src/example.js", kind: "skipped" },
  ])("preserves source eligibility without a read for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("returns every annotation in legacy category order with supplied anchors", () => {
    const observed = sourceObservations({ source: `// ${TYPE_EXPECTATION} missing\n// biome-ignore lint/example: rationale\n// ${TODO_ANNOTATION} first\n// ${TODO_ANNOTATION} second\n` });

    observed.observers.comment?.({ range: { kind: SYNTAX_API.SyntaxKind.SingleLineCommentTrivia, pos: 28, end: 67 } });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `// ${TODO_ANNOTATION} first` },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `// ${TODO_ANNOTATION} second` },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "// biome-ignore lint/example: rationale" },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `// ${TYPE_EXPECTATION} missing` },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledTimes(4);
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 68 });
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 82 });
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 28 });
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 0 });
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains tracked annotations, permissive parenthesised tasks and directive-lookalike exclusions", () => {
    const observed = sourceObservations({ source: `// ${TODO_ANNOTATION}(legacy) later\n// ${TYPE_EXPECTATION} reason (spec-099)\n// oxlint-disable no-alert (spec-099)\nconst note = '// eslint-disable no-alert';\n// ordinary explanation\n` });
    observed.observers.comment?.({ range: { kind: SYNTAX_API.SyntaxKind.SingleLineCommentTrivia, pos: 60, end: 97 } });
    observed.observers.comment?.({ range: { kind: SYNTAX_API.SyntaxKind.SingleLineCommentTrivia, pos: 141, end: 164 } });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("retains complete multiline directive snippets and refuses a tracker outside the comment", () => {
    const observed = sourceObservations({ source: "/* eslint no-console: off\nreason */\nconst tracker = '(spec-099)';\n" });

    observed.observers.comment?.({ range: { kind: SYNTAX_API.SyntaxKind.MultiLineCommentTrivia, pos: 0, end: 35 } });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "/* eslint no-console: off\nreason */" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("preserves existing raw-line matches inside strings without a comment observation", () => {
    const observed = sourceObservations({ source: `const note = '// ${TODO_ANNOTATION} later';\nconst marker = '// ${TYPE_EXPECTATION} ignored';\n` });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `const note = '// ${TODO_ANNOTATION} later';` },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: `const marker = '// ${TYPE_EXPECTATION} ignored';` },
    ]);
  });
});
