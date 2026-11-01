import { describe, expect, test } from "vitest";
import { disciplinesSensorWireOf, notEvaluatedWire } from "./rin-disciplines-sensor.ts";

const FAILING_REPORT = [
  "findings (2)",
  "CD-15#loops audit src/loop.ts:3:2 let total = 0;",
  "CD-1#any-cast audit src/other.ts:1:0 x as any",
  "verdict: fail",
  "",
].join("\n");

describe("disciplinesSensorWireOf", () => {
  test("reports only the edited file's findings, with a writer notice", () => {
    expect(disciplinesSensorWireOf({ outcome: { kind: "failed", report: FAILING_REPORT }, targetFile: "src/loop.ts" })).toEqual({
      pass: false,
      findings_count: 1,
      findings: [
        { clause: "CD-15#loops", mechanism: "audit", file: "src/loop.ts", line: 3, column: 2, snippet: "let total = 0;" },
      ],
      scanned: "src/loop.ts",
      writer_notice: "CD-15#loops src/loop.ts:3:2 let total = 0;",
    });
  });

  test("a failing run with nothing in the edited file passes for that file", () => {
    expect(
      disciplinesSensorWireOf({ outcome: { kind: "failed", report: FAILING_REPORT }, targetFile: "src/clean.ts" }),
    ).toMatchObject({ pass: true, findings_count: 0 });
  });

  test("a run that reached no verdict fails and names why", () => {
    expect(
      disciplinesSensorWireOf({ outcome: { kind: "unverified", reason: "exit 2: load failure" }, targetFile: "src/loop.ts" }),
    ).toEqual({
      pass: false,
      findings_count: 0,
      findings: [],
      scanned: "(discipline-core reached no verdict: exit 2: load failure)",
    });
  });

  test("the rin walker leaves the sensor not evaluated", () => {
    expect(notEvaluatedWire).toEqual({
      pass: true,
      findings_count: 0,
      findings: [],
      scanned: "(constitution.engine is rin-walker: the cd-* sensors apply)",
    });
  });
});
