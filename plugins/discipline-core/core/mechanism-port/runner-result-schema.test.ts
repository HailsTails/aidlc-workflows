import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import {
  type CaseVerdict,
  caseVerdictSchema,
  type Hit,
  hitSchema,
  projectionWriteSchema,
  runnerResultSchema,
} from "./runner-result-schema.ts";

const sharedClause = {
  ruleSet: "shared",
  discipline: "CD-14",
  clause: "no-class-syntax",
};

const hit = {
  clause: sharedClause,
  file: "src/a.ts",
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
};

const hitsResultSchema = runnerResultSchema({
  value: z.array(hitSchema).readonly(),
});

describe("hitSchema", () => {
  it("accepts a hit naming a clause address, a repository file, an anchor and a snippet", () => {
    expect(hitSchema.safeParse(hit)).toEqual({ success: true, data: hit });
  });

  it("accepts a hit on a named rule set's clause", () => {
    expect(
      hitSchema.safeParse({
        clause: { ruleSet: { name: "probe" }, discipline: "PD-1", clause: "no-tmp-files" },
        file: "src/a.ts",
        anchor: { line: 1, column: 1 },
        snippet: "tmp",
      }).success,
    ).toBe(true);
  });

  it("refuses a hit whose file is not a repository path", () => {
    expect(hitSchema.safeParse({ ...hit, file: "/repo/src/a.ts" }).success).toBe(false);
  });

  it("refuses a hit with no snippet", () => {
    expect(
      hitSchema.safeParse({
        clause: sharedClause,
        file: "src/a.ts",
        anchor: { line: 3, column: 5 },
      }).success,
    ).toBe(false);
  });

  it("accepts a hit anchored at line 1, column 0", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 1, column: 0 } }).success).toBe(true);
  });

  it("refuses a hit anchored at line 0", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 0, column: 5 } }).success).toBe(false);
  });

  it("refuses a hit anchored at column -1", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 3, column: -1 } }).success).toBe(false);
  });

  it("refuses a hit anchored at a fractional column", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 3, column: 2.5 } }).success).toBe(false);
  });

  it("refuses a hit anchored at a fractional line", () => {
    expect(hitSchema.safeParse({ ...hit, anchor: { line: 2.5, column: 5 } }).success).toBe(false);
  });

  it("refuses a hit with no anchor", () => {
    expect(
      hitSchema.safeParse({ clause: sharedClause, file: "src/a.ts", snippet: "class A {}" })
        .success,
    ).toBe(false);
  });

  it("refuses a hit whose clause names a malformed discipline", () => {
    expect(
      hitSchema.safeParse({
        ...hit,
        clause: { ruleSet: "shared", discipline: "cd-14", clause: "no-class-syntax" },
      }).success,
    ).toBe(false);
  });
});

describe("caseVerdictSchema", () => {
  it("accepts a case name with its flagged lines", () => {
    expect(caseVerdictSchema.safeParse({ caseName: "class", flaggedLines: [1, 4] })).toEqual({
      success: true,
      data: { caseName: "class", flaggedLines: [1, 4] },
    });
  });

  it("refuses flagged lines that are not numbers", () => {
    expect(
      caseVerdictSchema.safeParse({ caseName: "class", flaggedLines: ["1"] }).success,
    ).toBe(false);
  });

  it.each([0, -1, 2.5])("refuses a flagged line of %d", (line) => {
    expect(caseVerdictSchema.safeParse({ caseName: "class", flaggedLines: [1, line] }).success).toBe(
      false,
    );
  });

  it("refuses a verdict with no case name", () => {
    expect(caseVerdictSchema.safeParse({ flaggedLines: [] }).success).toBe(false);
  });

  it("infers flagged lines as a readonly array", () => {
    const readonlyLines: Equal<CaseVerdict["flaggedLines"], readonly number[]> = true;
    expect(readonlyLines).toBe(true);
  });
});

describe("projectionWriteSchema", () => {
  it.each(["written", "unchanged"])("accepts a %s write", (effect) => {
    expect(projectionWriteSchema.safeParse({ path: "eslint.config.js", effect })).toEqual({
      success: true,
      data: { path: "eslint.config.js", effect },
    });
  });

  it("refuses an effect outside written and unchanged", () => {
    expect(
      projectionWriteSchema.safeParse({ path: "eslint.config.js", effect: "deleted" }).success,
    ).toBe(false);
  });

  it("refuses a write whose path is not a repository path", () => {
    expect(
      projectionWriteSchema.safeParse({ path: "../eslint.config.js", effect: "written" })
        .success,
    ).toBe(false);
  });
});

describe("runnerResultSchema", () => {
  it("parses an ok envelope carrying its value", () => {
    expect(hitsResultSchema.safeParse({ outcome: "ok", value: [hit] })).toEqual({
      success: true,
      data: { outcome: "ok", value: [hit] },
    });
  });

  it("parses a failed envelope carrying a runner failure", () => {
    expect(
      hitsResultSchema.safeParse({
        outcome: "failed",
        error: { kind: "tool-failed", detail: "eslint exited 2" },
      }),
    ).toEqual({
      success: true,
      data: { outcome: "failed", error: { kind: "tool-failed", detail: "eslint exited 2" } },
    });
  });

  it("refuses an ok envelope whose value fails the value schema", () => {
    expect(hitsResultSchema.safeParse({ outcome: "ok", value: "no hits" }).success).toBe(false);
  });

  it("refuses a failed envelope whose error is not a runner failure", () => {
    expect(
      hitsResultSchema.safeParse({ outcome: "failed", error: { kind: "disk-full" } }).success,
    ).toBe(false);
  });

  it("refuses an envelope with an outcome outside ok and failed", () => {
    expect(hitsResultSchema.safeParse({ outcome: "skipped", value: [] }).success).toBe(false);
  });

  it("refuses a return that is not an envelope", () => {
    expect(hitsResultSchema.safeParse([hit]).success).toBe(false);
  });

  it("infers the result type the author contract returns", () => {
    const sameAsContract: Equal<
      z.output<typeof hitsResultSchema>,
      Result<readonly Hit[], RunnerFailure>
    > = true;
    expect(sameAsContract).toBe(true);
  });
});
