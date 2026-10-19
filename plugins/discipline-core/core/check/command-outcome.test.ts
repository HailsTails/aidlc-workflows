import { describe, expect, it } from "vitest";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { CheckReport } from "../verdict/check-report.ts";
import { checkCommandOutcome, projectCommandOutcome } from "./command-outcome.ts";

const WALKER = mechanismIdSchema.parse("audit");

const EMPTY_REPORT: CheckReport = {
  excluded: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
};

const CLASS_IN_A: Finding = {
  clause: clauseAddressSchema.parse("CD-14#class-syntax"),
  file: repoPathSchema.parse("src/a.ts"),
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
  mechanism: WALKER,
};

describe("checkCommandOutcome", () => {
  it("exits 0 and prints the report when the verdict is pass", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: EMPTY_REPORT } })).toEqual({
      code: 0,
      text: "verdict: pass\n",
    });
  });

  it("exits 1 and prints the report when the verdict is fail", () => {
    expect(checkCommandOutcome({ result: { outcome: "ok", value: { ...EMPTY_REPORT, findings: [CLASS_IN_A] } } })).toEqual({
      code: 1,
      text: "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nverdict: fail\n",
    });
  });

  it("exits 1 when the only entry is forfeiture-unmeasured", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "ok", value: { ...EMPTY_REPORT, unmeasured: [{ kind: "forfeiture-unmeasured" }] } },
      }),
    ).toEqual({ code: 1, text: "unmeasured (1)\nforfeiture-unmeasured\nverdict: fail\n" });
  });

  it("exits 2 and prints the load failure line when an input could not be loaded", () => {
    expect(
      checkCommandOutcome({
        result: { outcome: "failed", error: { kind: "file-malformed", path: "/repo/disciplines.json", detail: "Unexpected end" } },
      }),
    ).toEqual({ code: 2, text: "load failure: file-malformed /repo/disciplines.json Unexpected end\n" });
  });

  it("exits 2 and prints the load failure line when the arguments are invalid", () => {
    expect(
      checkCommandOutcome({ result: { outcome: "failed", error: { kind: "arguments-invalid", detail: "--repo is required" } } }),
    ).toEqual({ code: 2, text: "load failure: arguments-invalid --repo is required\n" });
  });

  it("exits 2 and names the runner failure when a runner failed", () => {
    expect(
      checkCommandOutcome({
        result: {
          outcome: "failed",
          error: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "runner-invalid-output", detail: "run rejected" } },
        },
      }),
    ).toEqual({ code: 2, text: "load failure: runner-failed audit runner-invalid-output run rejected\n" });
  });
});

describe("projectCommandOutcome", () => {
  it("exits 0 and prints nothing when there are no projection writes", () => {
    expect(projectCommandOutcome({ result: { outcome: "ok", value: [] } })).toEqual({ code: 0, text: "" });
  });

  it("exits 0 and prints one <path> <effect> line per projection write", () => {
    expect(
      projectCommandOutcome({
        result: {
          outcome: "ok",
          value: [
            { path: repoPathSchema.parse("eslint.discipline.config.mjs"), effect: "written" },
            { path: repoPathSchema.parse("config/eslint.discipline.mjs"), effect: "unchanged" },
          ],
        },
      }),
    ).toEqual({ code: 0, text: "eslint.discipline.config.mjs written\nconfig/eslint.discipline.mjs unchanged\n" });
  });

  it("exits 2 and prints the load failure line on a failure", () => {
    expect(
      projectCommandOutcome({ result: { outcome: "failed", error: { kind: "runner-missing", mechanism: WALKER } } }),
    ).toEqual({ code: 2, text: "load failure: runner-missing audit\n" });
  });
});
