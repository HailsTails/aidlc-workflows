import { describe, expect, it } from "vitest";
import { embeddedRunReportSchema } from "./embedded-run-report-schema.ts";

const CLASS_SYNTAX = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const HIT_IN_A = {
  clause: CLASS_SYNTAX,
  file: "src/a.ts",
  anchor: { line: 3, column: 2 },
  snippet: "class A {}",
};

const EVERY_NATIVE_KIND = [
  { kind: "ignore", clause: CLASS_SYNTAX, file: "src/generated.ts" },
  { kind: "config-override", clause: CLASS_SYNTAX, file: "src/legacy.ts" },
  {
    kind: "suppression-entry",
    clause: CLASS_SYNTAX,
    file: "src/old.ts",
    location: "eslint-suppressions.json",
  },
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 4,
    text: "// eslint-disable-next-line rin-discipline/no-class-authoring",
  },
  {
    kind: "inline-rule-config",
    clause: CLASS_SYNTAX,
    file: "src/a.ts",
    line: 1,
    text: '/* eslint rin-discipline/no-class-authoring: "off" */',
  },
  {
    kind: "command-line-option",
    clause: CLASS_SYNTAX,
    location: "package.json",
    script: "lint",
    option: "--suppress-all",
  },
];

describe("embeddedRunReportSchema", () => {
  it("accepts a report holding a hit, one native exception of every kind and a not-included projection", () => {
    const report = { hits: [HIT_IN_A], evaluated: [], nativeExceptions: EVERY_NATIVE_KIND, projection: "not-included" };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a current projection with no hits and no native exceptions", () => {
    const report = { hits: [], evaluated: [], nativeExceptions: [], projection: "current" };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts an out-of-date projection", () => {
    const report = { hits: [HIT_IN_A], evaluated: [], nativeExceptions: [], projection: "out-of-date" };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("accepts a missing projection", () => {
    const report = { hits: [], evaluated: [], nativeExceptions: [], projection: "missing" };
    expect(embeddedRunReportSchema.safeParse(report)).toEqual({ success: true, data: report });
  });

  it("refuses a projection state outside the four, at the projection key", () => {
    expect(
      embeddedRunReportSchema.safeParse({ hits: [], evaluated: [], nativeExceptions: [], projection: "stale" }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projection"] }] } });
  });

  it("refuses the standalone none as a projection state, at the projection key", () => {
    expect(
      embeddedRunReportSchema.safeParse({ hits: [], evaluated: [], nativeExceptions: [], projection: "none" }),
    ).toMatchObject({ success: false, error: { issues: [{ path: ["projection"] }] } });
  });

  it("refuses a native exception of an unknown kind, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        evaluated: [], nativeExceptions: [{ kind: "baseline", clause: CLASS_SYNTAX, file: "src/a.ts" }],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses a native exception whose file is not a repo path, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        evaluated: [], nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "/repo/src/a.ts" }],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses an inline disable with no line, within that exception", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [],
        evaluated: [], nativeExceptions: [
          { kind: "inline-disable", clause: CLASS_SYNTAX, file: "src/a.ts", text: "// eslint-disable" },
        ],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["nativeExceptions", 0]) }] },
    });
  });

  it("refuses a hit whose file is not a repo path, within that hit", () => {
    expect(
      embeddedRunReportSchema.safeParse({
        hits: [{ ...HIT_IN_A, file: "/repo/src/a.ts" }],
        evaluated: [], nativeExceptions: [],
        projection: "current",
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [{ path: expect.arrayContaining(["hits", 0]) }] },
    });
  });

  it("refuses a report with no projection, at the projection key", () => {
    expect(embeddedRunReportSchema.safeParse({ hits: [], evaluated: [], nativeExceptions: [] })).toMatchObject({
      success: false,
      error: { issues: [{ path: ["projection"] }] },
    });
  });
});
