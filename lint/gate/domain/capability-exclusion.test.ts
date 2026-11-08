import { describe, expect, test } from "bun:test";
import {
  classifyFailures,
  excludedNote,
  failedCases,
  type CapabilityExclusion,
  type Probes,
} from "./capability-exclusion.ts";

const SYMLINK_CASE = "t243 archive > rejects symlink traversal";
const LINKLESS: Probes = {
  symlinks: { available: false, evidence: "creating a symlink is refused (EPERM)" },
  "short-names": { available: true, evidence: "8.3 short names are on" },
  unattributed: { available: false, evidence: "cause not proved; no probe" },
};
const EXCLUSIONS: readonly CapabilityExclusion[] = [
  { capability: "symlinks", cases: [SYMLINK_CASE] },
];

const classify = (request: { failed: readonly string[]; probes: Probes }) =>
  classifyFailures({ ...request, exclusions: EXCLUSIONS });

describe("failed cases", () => {
  test("the bun failure lines are read without their timing", () => {
    const output = "(fail) a > b [12.5ms]\n(pass) c\n(fail) d > e\nerror: nope";
    expect(failedCases(output)).toEqual(["a > b", "d > e"]);
  });

  test("a case the runner prints twice is counted once", () => {
    const output = ["(fail) a > b [1ms]", "(fail) a > b"].join("\n");
    expect(failedCases(output)).toEqual(["a > b"]);
  });
});

describe("capability exclusions", () => {
  test("green: a listed case failing where its capability is missing is excluded and named", () => {
    const result = classify({ failed: [SYMLINK_CASE], probes: LINKLESS });
    expect(result.regressions).toEqual([]);
    expect(excludedNote(result.excluded)).toBe(
      "1 case(s) excluded for symlinks (creating a symlink is refused (EPERM))",
    );
  });

  test("red: a failing case that no exclusion lists is a regression", () => {
    const result = classify({ failed: ["t1 > new break"], probes: LINKLESS });
    expect(result.regressions).toEqual(["t1 > new break"]);
  });

  test("red: a listed case failing where its capability is present is a regression", () => {
    const capable: Probes = {
      ...LINKLESS,
      symlinks: { available: true, evidence: "creating a symlink works" },
    };
    const result = classify({ failed: [SYMLINK_CASE], probes: capable });
    expect(result.regressions).toEqual([SYMLINK_CASE]);
    expect(result.excluded).toEqual([]);
  });
});
