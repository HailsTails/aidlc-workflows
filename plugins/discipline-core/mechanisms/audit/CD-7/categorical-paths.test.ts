import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./categorical-paths.ts";

const ADDRESS = clauseAddressSchema.parse("CD-7#categorical-paths");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-7",
  settings: { module: "categorical-paths.ts" },
};

const preparedFor = (request: { readonly file: WalkerFile["file"] }): PreparedWalkerCheck => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [request.file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("CD-7 existing categorical path checks", () => {
  it("completes both filename and first-folder findings in order without reading content", () => {
    const file = repoPathSchema.parse("src/common/helpers/types.ts");
    const prepared = preparedFor({ file });
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    const observation = prepared.prepareFile({ file, readText });

    expect(observation).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [
          { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "forbidden categorical filename: types.ts" },
          { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "forbidden categorical folder: common" },
        ],
      },
    });
    expect(readText).not.toHaveBeenCalled();
    expect(prepared.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it.each(["src/account-types.ts", "src/Types.ts", "src/types.tsx"])("retains the exact filename gap for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual({ outcome: "ok", value: { kind: "complete", hits: [] } });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([
    { name: "all-depth exclusion", fileName: "src/node_modules/types.ts", expected: { outcome: "ok", value: { kind: "skipped" } } },
    { name: "root-only exclusion", fileName: "vendor/types.ts", expected: { outcome: "ok", value: { kind: "skipped" } } },
    { name: "nested root-only directory", fileName: "src/vendor/types.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "forbidden categorical filename: types.ts" }] } } },
    { name: "physical script", fileName: "scripts/types.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "forbidden categorical filename: types.ts" }] } } },
    { name: "test source", fileName: "src/example.test.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } } },
    { name: "declaration source", fileName: "src/example.d.ts", expected: { outcome: "ok", value: { kind: "complete", hits: [] } } },
    { name: "non-TypeScript candidate", fileName: "src/types.js", expected: { outcome: "ok", value: { kind: "skipped" } } },
  ])("preserves path-family eligibility and findings for $name", ({ fileName, expected }) => {
    const file = repoPathSchema.parse(fileName);
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(preparedFor({ file }).prepareFile({ file, readText })).toEqual(expected);
    expect(readText).not.toHaveBeenCalled();
  });
});
