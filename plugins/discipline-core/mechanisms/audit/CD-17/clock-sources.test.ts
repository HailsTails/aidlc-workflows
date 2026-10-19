import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./clock-sources.ts";

const FILE = repoPathSchema.parse("src/clock-source.ts");
const ADDRESS = clauseAddressSchema.parse("CD-17#clock-sources");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const DATE_NOW = "Date" + ".now()";
const NEW_DATE = "new" + " Date";
const LINE_COMMENT = "/" + "/";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-17",
  settings: { module: "clock-sources.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-17 existing raw clock observations", () => {
  it("returns all CRLF line findings in order with one hit per line and full uncollapsed snippets", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `  const first = ${NEW_DATE}().getTime();\r\n  ${DATE_NOW}; ${NEW_DATE}();\r\n  const description = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";   ${DATE_NOW};  \r\n` });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `const first = ${NEW_DATE}().getTime();` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${DATE_NOW}; ${NEW_DATE}();` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `const description = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";   ${DATE_NOW};` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains comment and string false positives and construction without parentheses", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${LINE_COMMENT} ${DATE_NOW}\nconst literal = "${NEW_DATE}";\nconst constructor = ${NEW_DATE};\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${LINE_COMMENT} ${DATE_NOW}` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `const literal = "${NEW_DATE}";` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `const constructor = ${NEW_DATE};` },
      ] },
    });
  });

  it("keeps exact-spelling gaps and accepts an injected clock without syntax", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "Date.now ( );\nnew\tDate();\nDate();\nperformance.now();\nclock.now();\n" });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates an eligible cached read failure without successful empty observations", () => {
    const readFailure: RunnerFailure = { kind: "file-unreadable", file: FILE, detail: "unreadable clock source" };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: readFailure });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/clock.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "root-only exclusion", fileName: "vendor/clock.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "nested root-only directory", fileName: "src/vendor/clock.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "ordinary TSX source", fileName: "src/Clock.tsx", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "test source", fileName: "src/clock.test.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "declaration source", fileName: "src/clock.d.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "physical script member", fileName: "scripts/clock.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "non-TypeScript union input", fileName: "src/clock.js", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
  ])("preserves exact source membership for $name", ({ fileName, expected, readCount }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const now = clock.now();" });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).toHaveBeenCalledTimes(readCount);
  });
});

