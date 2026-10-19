import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./hermetic-git-spawns.ts";

const FILE = repoPathSchema.parse("tests/git.test.ts");
const ADDRESS = clauseAddressSchema.parse("CD-47#hermetic-git-spawns");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const GIT = "g" + "it";
const SPAWN = "spawn" + "Sync";
const LINE_COMMENT = "/" + "/";
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-47",
  settings: { module: "hermetic-git-spawns.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-47 existing raw Git spawn guard", () => {
  it("returns complete ordered CRLF findings with full trimmed lines and one finding for multiple calls on a line", () => {
    const prepared = preparedFor({ file: FILE });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `  ${SPAWN}("${GIT}", ["status"]); ${SPAWN}("${GIT}", ["diff"]);  abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz  \r\nconst fixed = 1;\r\n  execFile('${GIT}', ['status']);  \r\n` });

    expect(prepared.prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${SPAWN}("${GIT}", ["status"]); ${SPAWN}("${GIT}", ["diff"]);  abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz` },
        { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: `execFile('${GIT}', ['status']);` },
      ] },
    });
    expect(readText).toHaveBeenCalledTimes(1);
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("accepts a recognized environment on the eighth line but not the ninth", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${SPAWN}("${GIT}", []);\n\n\n\n\n\n\nenv: repository.environment\n${SPAWN}("${GIT}", []);\n\n\n\n\n\n\n\nenv: repository.environment\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 9, column: 0 }, snippet: `${SPAWN}("${GIT}", []);` },
      ] },
    });
  });

  it.each([
    { name: "recognized nearby environment shape", suffix: "env: hermeticGitEnvironment({});", hits: [] },
    { name: "ambient override after the recognized shape", suffix: "env: hermeticGitEnvironment({});\nenv: process.env", hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `${SPAWN}("${GIT}", []);` }] },
  ])("preserves the lexical environment approximation for $name", ({ suffix, hits }) => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `${SPAWN}("${GIT}", []);\n${suffix}` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits } });
  });

  it("preserves string and comment matches, template literals and split-call alias and nonliteral gaps", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: `const literal = "${SPAWN}('${GIT}', [])";\n${LINE_COMMENT} exec("${GIT}", []);\nrun("${GIT}", []);\n${SPAWN}(\n"${GIT}", []);\n${SPAWN}("node", []);\n${SPAWN}(command, []);\nexeca(\`${GIT}\`, []);\n` });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [
        { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: `const literal = "${SPAWN}('${GIT}', [])";` },
        { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: `${LINE_COMMENT} exec("${GIT}", []);` },
        { clause: ADDRESS, anchor: { line: 8, column: 0 }, snippet: `execa(\`${GIT}\`, []);` },
      ] },
    });
  });

  it("keeps an eligible clean file complete and applicable without a synthetic count hit", () => {
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const fixed = 1;" });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it("propagates a requested cached read failure rather than certifying empty observations", () => {
    const readFailure: RunnerFailure = { kind: "file-unreadable", file: FILE, detail: "unreadable guard input" };
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: readFailure });

    expect(preparedFor({ file: FILE }).prepareFile({ file: FILE, readText })).toEqual({ outcome: "failed", error: readFailure });
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "all-depth generated folder exclusion", fileName: "src/node_modules/git.test.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "JavaScript test", fileName: "src/git.test.js", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "TSX test", fileName: "src/git.test.tsx", expected: { outcome: "ok", value: { kind: "complete", hits: [] } }, readCount: 1 },
    { name: "ordinary source", fileName: "src/git.ts", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
    { name: "unsupported JavaScript spec", fileName: "src/git.spec.js", expected: { outcome: "ok", value: { kind: "skipped" } }, readCount: 0 },
  ])("preserves the distinct test population for $name", ({ fileName, expected, readCount }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: "const fixed = 1;" });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).toHaveBeenCalledTimes(readCount);
  });
});
