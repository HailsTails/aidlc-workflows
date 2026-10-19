import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./factory-return-types.ts";

const FILE = repoPathSchema.parse("src/profile.ts");
const ADDRESS = clauseAddressSchema.parse("CD-7a#factory-return-types");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const TYPE_QUERY = "Return" + "Type";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-7a",
  settings: { module: "factory-return-types.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-7a existing raw factory-type query check", () => {
  it("completes ordered CRLF line findings with one read and no syntax request", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `type First = ${TYPE_QUERY}<typeof createFirst>;\r\ntype Second = OwnedSecond;\r\ntype Third = ${TYPE_QUERY}<typeof createThird>;\r\n` });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `type First = ${TYPE_QUERY}<typeof createFirst>;` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `type Third = ${TYPE_QUERY}<typeof createThird>;` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("preserves raw-line false positives, partial matches, one hit per line and ignored prefixes", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `const literal = '${TYPE_QUERY}<typeof create>';\nconst stable = 1; // ${TYPE_QUERY}<typeof create>\ntype Twice = [${TYPE_QUERY}<typeof first>, ${TYPE_QUERY}<typeof second>];\ntype Unclosed = ${TYPE_QUERY}<typeof factory\ntype Split = ${TYPE_QUERY}<\ntypeof factory>;\n  // ${TYPE_QUERY}<typeof ignored>\n /* ${TYPE_QUERY}<typeof ignored> */\n * ${TYPE_QUERY}<typeof ignored>\ntype Owned = FactoryResult;\ntype Indexed = FactoryOutput['member'];\ntype Runtime = typeof factory;\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `const literal = '${TYPE_QUERY}<typeof create>';` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `const stable = 1; // ${TYPE_QUERY}<typeof create>` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `type Twice = [${TYPE_QUERY}<typeof first>, ${TYPE_QUERY}<typeof second>];` },
        { clause: ADDRESS, anchor: { line: 4, column: 0 }, snippet: `type Unclosed = ${TYPE_QUERY}<typeof factory` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("collapses line whitespace and adds ellipsis only above eighty characters", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `  type\t  Profile = ${TYPE_QUERY}<typeof factory>;  //   abcdefghijklmnopqrstuvwxyzabcdefgh   \r\n  type\t  Profile = ${TYPE_QUERY}<typeof factory>;  //   abcdefghijklmnopqrstuvwxyzabcdefghz   \r\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `type Profile = ${TYPE_QUERY}<typeof factory>; // abcdefghijklmnopqrstuvwxyzabcdefgh` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `type Profile = ${TYPE_QUERY}<typeof factory>; // abcdefghijklmnopqrstuvwxyzabcdefgh…` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates the requested cached read failure rather than returning successful empty findings", () => {
    const readFailure: RunnerFailure = { kind: "file-unreadable", file: FILE, detail: "unreadable fixture" };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: readFailure });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/.claude/profile.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "root-only exclusion", fileName: "vendor/profile.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "nested root-only directory", fileName: "src/vendor/profile.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "TSX source", fileName: "src/profile.tsx", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "test source", fileName: "src/profile.test.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "declaration source", fileName: "src/profile.d.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "physical script", fileName: "scripts/profile.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "unexcluded audit basename", fileName: "src/audit-constitution.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "non-TypeScript candidate", fileName: "src/profile.md", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
  ])("preserves composed source-family eligibility for $name", ({ fileName, expected, readCount }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "type Profile = OwnedProfile;" });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).toHaveBeenCalledTimes(readCount);
  });
});
