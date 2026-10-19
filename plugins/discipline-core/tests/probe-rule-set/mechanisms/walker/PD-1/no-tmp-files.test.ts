import { assert, describe, expect, it, vi } from "vitest";
import { clauseAddressSchema } from "../../../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../../../../../mechanisms/walker/runner/typescript-parse.ts";
import type { WalkerFile } from "../../../../../mechanisms/walker/runner/walker-piece.ts";
import { check } from "./no-tmp-files.ts";

const ADDRESS = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const preparedCheck = () => {
  const prepared = check.prepare({
    clauses: [{ address: ADDRESS, anchor: { kind: "file" }, pieceRoot: "/probe", settings: {} }],
    repository: { files: [], exists: () => "absent" },
    syntaxApi: createDefaultParsePort({}).syntaxApi,
  });
  assert(prepared.outcome === "ok");
  return prepared.value;
};

describe("probe PD-1 no-tmp-files path check", () => {
  it("flags a file whose name ends .tmp.ts", () => {
    const readText = vi.fn<WalkerFile["readText"]>();
    expect(preparedCheck().prepareFile({ file: repoPathSchema.parse("src/scratch.tmp.ts"), readText })).toEqual({
      outcome: "ok", value: { kind: "complete", hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "src/scratch.tmp.ts" }] },
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("passes an ordinary TypeScript file", () => {
    const readText = vi.fn<WalkerFile["readText"]>();
    expect(preparedCheck().prepareFile({ file: repoPathSchema.parse("src/kept.ts"), readText })).toEqual({
      outcome: "ok", value: { kind: "complete", hits: [] },
    });
    expect(readText).not.toHaveBeenCalled();
  });
});
