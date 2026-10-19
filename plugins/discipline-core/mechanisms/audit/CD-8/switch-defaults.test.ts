import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./switch-defaults.ts";

const FILE = repoPathSchema.parse("src/state.ts");
const ADDRESS = clauseAddressSchema.parse("CD-8#switch-defaults");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const SWITCH = "sw" + "itch";
const DEFAULT = "def" + "ault";
const LINE_COMMENT = "/" + "/";
const BLOCK_OPEN = "/" + "*";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-8",
  settings: { module: "switch-defaults.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-8 existing raw switch state", () => {
  it("completes every ordered CRLF finding through one read without requesting syntax", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${SWITCH} (first) {\r\ncase 'a': return 1;\r\n  ${DEFAULT}: first;\r\n}\r\n${SWITCH} (second) { ${DEFAULT}: second; }\r\n` });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `${DEFAULT}: first;` },
        { clause: ADDRESS, anchor: { line: 5, column: 0 }, snippet: `${SWITCH} (second) { ${DEFAULT}: second; }` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("preserves same-line opener ordering, one hit per line, numeric close depth and arm boundaries", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${DEFAULT}: before; ${SWITCH} (value) { ${DEFAULT}: twice; }\n${DEFAULT}: outside;\n${SWITCH} (outer) {\n{ }\n${DEFAULT}: premature miss;\n${SWITCH} (next) {\nobject.${DEFAULT}: ignore; my${DEFAULT}: ignore;\n${DEFAULT}: final; }\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${DEFAULT}: before; ${SWITCH} (value) { ${DEFAULT}: twice; }` },
        { clause: ADDRESS, anchor: { line: 8, column: 0 }, snippet: `${DEFAULT}: final; }` },
      ] },
    });
  });

  it("preserves raw string and inline false positives while ignored prefixes do not change depth", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `  ${LINE_COMMENT} ${SWITCH} (ignored) { ${DEFAULT}: ignored; }\n ${BLOCK_OPEN} ${SWITCH} (ignored) { ${DEFAULT}: ignored; }\n * ${SWITCH} (ignored) { ${DEFAULT}: ignored; }\nconst literal = '${SWITCH} (value) { ${DEFAULT}: string; }';\nconst stable = 1; ${LINE_COMMENT} ${SWITCH} (value) { ${DEFAULT}: inline; }\n${SWITCH}\n(value) {\n${DEFAULT}: split miss;\n${SWITCH} (retained) {\n${LINE_COMMENT} }\n${DEFAULT}: still observed; }\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 4, column: 0 }, snippet: `const literal = '${SWITCH} (value) { ${DEFAULT}: string; }';` },
        { clause: ADDRESS, anchor: { line: 5, column: 0 }, snippet: `const stable = 1; ${LINE_COMMENT} ${SWITCH} (value) { ${DEFAULT}: inline; }` },
        { clause: ADDRESS, anchor: { line: 11, column: 0 }, snippet: `${DEFAULT}: still observed; }` },
      ] },
    });
  });

  it("collapses whole-line whitespace and truncates only above eighty characters", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${SWITCH} (value) {\r\n  ${DEFAULT}:\t  abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrs  \r\n  ${DEFAULT}:\t  abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrst  \r\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${DEFAULT}: abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrs` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `${DEFAULT}: abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrs…` },
      ] },
    });
  });

  it("returns an observed clean explicit-case source as complete empty findings", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${SWITCH} (value) {\ncase 'a': return first;\ncase 'b': return second;\n}\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates the requested cached read failure unchanged", () => {
    const readFailure: RunnerFailure = { kind: "file-unreadable", file: FILE, detail: "unreadable switch source" };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: readFailure });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/state.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "root-only exclusion", fileName: "vendor/state.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "nested root-only directory", fileName: "src/vendor/state.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "TSX source", fileName: "src/state.tsx", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "test source", fileName: "src/state.test.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "declaration source", fileName: "src/state.d.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "physical script", fileName: "scripts/state.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "non-TypeScript candidate", fileName: "src/state.js", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
  ])("preserves composed source-family eligibility for $name", ({ fileName, expected, readCount }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const state = 'clean';" });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).toHaveBeenCalledTimes(readCount);
  });
});
