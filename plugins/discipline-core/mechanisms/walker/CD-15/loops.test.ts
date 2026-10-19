import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./loops.ts";

const FILE = repoPathSchema.parse("src/items.ts");
const ADDRESS = clauseAddressSchema.parse("CD-15#loops");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const FOR = "f" + "or";
const WHILE = "wh" + "ile";
const SWITCH = "sw" + "itch";
const DEFAULT = "def" + "ault";
const LINE_COMMENT = "/" + "/";
const BLOCK_OPEN = "/" + "*";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-15",
  settings: { module: "loops.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-15 existing raw loop observations and counted-for redirect", () => {
  it("completes all ordered CRLF findings under selected CD15 through one read without syntax", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${FOR} (const item of items) consume(item);\r\n${FOR} await (const chunk of stream) consume(chunk);\r\n${FOR} (let index = 0; index < size; index++) consume(index);\r\n${WHILE} (ready) consume();\r\ndo consume(); ${WHILE} (ready);\r\n` });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${FOR} (const item of items) consume(item);` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${FOR} await (const chunk of stream) consume(chunk);` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `${FOR} (let index = 0; index < size; index++) consume(index);` },
        { clause: ADDRESS, anchor: { line: 4, column: 0 }, snippet: `${WHILE} (ready) consume();` },
        { clause: ADDRESS, anchor: { line: 5, column: 0 }, snippet: `do consume(); ${WHILE} (ready);` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains every matching kind on one line and one finding for repeated instances of the same kind", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);\n${FOR} (x of xs); ${FOR} (y of ys);\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);` },
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);` },
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${FOR} (x of xs); ${FOR} (i=0;i<n;i++); ${WHILE} (ready);` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${FOR} (x of xs); ${FOR} (y of ys);` },
      ] },
    });
  });

  it("preserves literal and inline matches, ignored prefixes and unsupported header gaps without cross-rule findings", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `const literal = '${WHILE} (ready)';\nconst stable = 1; ${LINE_COMMENT} ${FOR} (i=0;i<n;i++);\n  ${LINE_COMMENT} ${WHILE} (ignored)\n ${BLOCK_OPEN} ${FOR} (item of ignored)\n * ${FOR} (i=0;i<n;i++);\n${FOR} (const key in record) consume(key);\n${FOR} (const item\nof items) consume(item);\n${FOR} (const [item = load()] of items) consume(item);\n${FOR} (let index = 0; ready(index); index++) consume(index);\n${FOR} await (i=0;i<n;i++);\n${SWITCH} (value) { ${DEFAULT}: otherRule; }\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `const literal = '${WHILE} (ready)';` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `const stable = 1; ${LINE_COMMENT} ${FOR} (i=0;i<n;i++);` },
      ] },
    });
  });

  it("collapses whole-line whitespace and truncates only above eighty characters", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `  ${WHILE}\t (ready)   { }   abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij  \r\n  ${WHILE}\t (ready)   { }   abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijk  \r\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${WHILE} (ready) { } abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${WHILE} (ready) { } abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghij…` },
      ] },
    });
  });

  it("returns an observed clean transformation as complete empty findings", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const doubled = items.map(item => item * 2);" });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates the requested cached read failure unchanged", () => {
    const readFailure: RunnerFailure = { kind: "file-unreadable", file: FILE, detail: "unreadable loop source" };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: readFailure });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/items.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "root-only exclusion", fileName: "vendor/items.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "nested root-only directory", fileName: "src/vendor/items.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "TSX source", fileName: "src/items.tsx", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "test source", fileName: "src/items.test.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "declaration source", fileName: "src/items.d.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "physical script", fileName: "scripts/items.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "non-TypeScript candidate", fileName: "src/items.js", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
  ])("preserves composed source-family eligibility for $name", ({ fileName, expected, readCount }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const items = [];" });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).toHaveBeenCalledTimes(readCount);
  });
});
