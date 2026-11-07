import { describe, expect, test } from "vitest";
import {
  judgedReport,
  lineLocation,
  renderSensorReport,
  type SensorFinding,
  unmeasuredFinding,
  unmeasuredReport,
} from "./rin-gates-sensor-report.ts";

const CODE_FENCE_FINDING: SensorFinding = {
  check: "framing-only",
  artefact: "rin-requirements.md",
  location: { kind: "line", lineNumber: 4 },
  subject: "code fence `ts`",
  remedy: "Remove it.",
};

describe("judgedReport", () => {
  test("is clean when there are no findings", () => {
    expect(
      judgedReport({ sensor: "framing-only", findings: [], scanned: "x.md" }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "clean",
      findings: [],
      scanned: "x.md",
    });
  });

  test("is refused when there is a finding", () => {
    expect(
      judgedReport({
        sensor: "framing-only",
        findings: [CODE_FENCE_FINDING],
        scanned: "x.md",
      }),
    ).toEqual({
      sensor: "framing-only",
      verdict: "refused",
      findings: [CODE_FENCE_FINDING],
      scanned: "x.md",
    });
  });
});

describe("unmeasuredReport", () => {
  test("carries the unmeasured verdict with its findings", () => {
    expect(
      unmeasuredReport({
        sensor: "solution-options",
        findings: [CODE_FENCE_FINDING],
        scanned: "x.md",
      }),
    ).toEqual({
      sensor: "solution-options",
      verdict: "unmeasured",
      findings: [CODE_FENCE_FINDING],
      scanned: "x.md",
    });
  });
});

describe("unmeasuredFinding", () => {
  test("names the reason, points at the whole artefact and asks for the input back when an input is unavailable", () => {
    expect(
      unmeasuredFinding({
        check: "solution-options",
        artefact: "rin-solution-options.md",
        reason: "rin-solution-options.md is unreadable (EACCES)",
        cause: "input-unavailable",
      }),
    ).toEqual({
      check: "solution-options",
      artefact: "rin-solution-options.md",
      location: { kind: "artefact" },
      subject: "unmeasured: rin-solution-options.md is unreadable (EACCES)",
      remedy:
        "The sensor could not read an input this gate needs, so it refuses rather than passes. Restore the named input and re-run the gate.",
    });
  });

  test("tells a wrong-gate invocation to move the sensor, not to restore an input", () => {
    expect(
      unmeasuredFinding({
        check: "framing-only",
        artefact: "rin-interface-lock.md",
        reason: "framing-only judges Gate 2 only",
        cause: "wrong-gate",
      }),
    ).toEqual({
      check: "framing-only",
      artefact: "rin-interface-lock.md",
      location: { kind: "artefact" },
      subject: "unmeasured: framing-only judges Gate 2 only",
      remedy:
        "The sensor judges one gate only, so it refuses rather than passes elsewhere. Remove it from the invoking stage's sensors list, or run it at its own gate.",
    });
  });

  test("tells an incomplete invocation which flags to supply", () => {
    expect(
      unmeasuredFinding({
        check: "measured-contracts",
        artefact: "rin-interface-lock.md",
        reason: "missing --stage",
        cause: "incomplete-invocation",
      }),
    ).toEqual({
      check: "measured-contracts",
      artefact: "rin-interface-lock.md",
      location: { kind: "artefact" },
      subject: "unmeasured: missing --stage",
      remedy:
        "The sensor was invoked without the flags it needs, so it refuses rather than passes. Invoke it with --stage and --output-path, as the engine does for a sensor a stage lists.",
    });
  });
});

describe("lineLocation", () => {
  test("builds a line location", () => {
    expect(lineLocation({ lineNumber: 7 })).toEqual({
      kind: "line",
      lineNumber: 7,
    });
  });
});

describe("renderSensorReport", () => {
  test("renders a clean report as a passing JSON line", () => {
    expect(
      renderSensorReport({
        report: {
          sensor: "framing-only",
          verdict: "clean",
          findings: [],
          scanned: "x.md",
        },
      }),
    ).toBe(
      '{"pass":true,"sensor":"framing-only","verdict":"clean","findings_count":0,"findings":[],"scanned":"x.md"}\n',
    );
  });

  test("renders an unmeasured report as failing", () => {
    expect(
      renderSensorReport({
        report: {
          sensor: "framing-only",
          verdict: "unmeasured",
          findings: [],
          scanned: "x.md",
        },
      }),
    ).toBe(
      '{"pass":false,"sensor":"framing-only","verdict":"unmeasured","findings_count":0,"findings":[],"scanned":"x.md"}\n',
    );
  });

  test("renders a refused report with its findings as failing, counting them", () => {
    expect(
      renderSensorReport({
        report: {
          sensor: "framing-only",
          verdict: "refused",
          findings: [CODE_FENCE_FINDING],
          scanned: "x.md",
        },
      }),
    ).toBe(
      '{"pass":false,"sensor":"framing-only","verdict":"refused","findings_count":1,"findings":[{"check":"framing-only","artefact":"rin-requirements.md","location":{"kind":"line","lineNumber":4},"subject":"code fence `ts`","remedy":"Remove it."}],"scanned":"x.md"}\n',
    );
  });
});
