import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../../../core/mechanism-port/runner-module-schema.ts";
import { clauseAddressSchema } from "../../../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../../../core/values/repo-path.ts";
import { createDefaultParsePort } from "../../../../../mechanisms/walker/runner/typescript-parse.ts";
import { check } from "./no-tmp-files.ts";

const ADDRESS = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/probe/mechanisms/walker/PD-1",
  settings: { module: "no-tmp-files.ts" },
};

const fileCheckOf = (request: { readonly file: string }) => {
  const file = repoPathSchema.parse(request.file);
  const prepared = check.prepare({
    clauses: [CLAUSE],
    repository: { files: [file], exists: vi.fn().mockReturnValue("present") },
    syntaxApi: createDefaultParsePort({}).syntaxApi,
  });
  assert(prepared.outcome === "ok");
  return prepared.value.prepareFile({ file, readText: vi.fn() });
};

describe("probe PD-1 no-tmp-files path check", () => {
  it("flags a file whose name ends .tmp.ts at line 1", () => {
    expect(fileCheckOf({ file: "src/scratch.tmp.ts" })).toEqual({
      outcome: "ok",
      value: {
        kind: "complete",
        hits: [{ clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "src/scratch.tmp.ts" }],
      },
    });
  });

  it("passes an ordinary TypeScript file", () => {
    expect(fileCheckOf({ file: "src/kept.ts" })).toEqual({
      outcome: "ok",
      value: { kind: "complete", hits: [] },
    });
  });
});
