import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  phaseOfGate,
  rosterFloorRefusal,
  scopeCoverageOf,
  verdictPath,
} from "./rin-gates-autonomy-gate.ts";

const GATE = "rin-gate-3-interface-lock";
const FLOOR = [
  "aidlc-architecture-reviewer-agent",
  "rin-clean-architecture-reviewer-agent",
] as const;

describe("rin-gates-autonomy-gate scopeCoverageOf", () => {
  test("covers a Rin scope with Gate 5 set to EXECUTE", () => {
    expect(
      scopeCoverageOf({
        scope: "rin-unit",
        grid: {
          "rin-unit": { stages: { "rin-gate-5-review-cycle": "EXECUTE" } },
        },
      }),
    ).toEqual({ kind: "covered" });
  });

  test("excludes a Rin scope with Gate 5 set to SKIP", () => {
    expect(
      scopeCoverageOf({
        scope: "rin-unit",
        grid: {
          "rin-unit": { stages: { "rin-gate-5-review-cycle": "SKIP" } },
        },
      }),
    ).toEqual({ kind: "not-covered" });
  });

  test("preserves Gate 5 coverage for an existing Rin scope", () => {
    expect(
      scopeCoverageOf({
        scope: "rin-bugfix",
        grid: {
          "rin-bugfix": {
            stages: { "rin-gate-5-review-cycle": "EXECUTE" },
          },
        },
      }),
    ).toEqual({ kind: "covered" });
  });

  test("refuses a Rin scope missing from the grid", () => {
    expect(scopeCoverageOf({ scope: "rin-unit", grid: {} })).toEqual({
      kind: "indeterminate",
      reason: "the grid carries no 'rin-unit' row",
    });
  });

  test("refuses a Rin scope when the grid is missing", () => {
    expect(scopeCoverageOf({ scope: "rin-unit", grid: undefined })).toEqual({
      kind: "indeterminate",
      reason: "the scope grid is missing or unreadable",
    });
  });

  test("refuses a Rin scope when the grid is unreadable", () => {
    expect(scopeCoverageOf({ scope: "rin-unit", grid: null })).toEqual({
      kind: "indeterminate",
      reason: "the scope grid is missing or unreadable",
    });
  });

  test("refuses a Rin scope with malformed stages", () => {
    expect(
      scopeCoverageOf({ scope: "rin-unit", grid: { "rin-unit": {} } }),
    ).toEqual({
      kind: "indeterminate",
      reason:
        "the grid row for 'rin-unit' is malformed — its 'stages' is not an object",
    });
  });

  test("refuses a Rin scope with an unknown Gate 5 cell", () => {
    expect(
      scopeCoverageOf({
        scope: "rin-unit",
        grid: { "rin-unit": { stages: {} } },
      }),
    ).toEqual({
      kind: "indeterminate",
      reason:
        "the grid row for 'rin-unit' holds no 'rin-gate-5-review-cycle' key",
    });
  });

  test("leaves a non-Rin scope outside the autonomy backstop", () => {
    expect(scopeCoverageOf({ scope: "classic", grid: {} })).toEqual({
      kind: "not-covered",
    });
  });
});

// IF-2: the floor applies to EVERY accepted emitter. Both faces are contract,
// not test detail — a deny-only implementation cannot be distinguished from one
// that refuses everything, which is this record's own thesis.
describe("rin-gates-autonomy-gate rosterFloorRefusal — the roster floor, both faces", () => {
  test("permits a verdict whose lenses cover the resolved floor", () => {
    expect(
      rosterFloorRefusal({
        gate: GATE,
        resolution: { kind: "resolved", roster: FLOOR, source: "byGate" },
        lenses: [...FLOOR],
      }),
    ).toBeNull();
  });

  test("permits a verdict carrying MORE lenses than the floor requires", () => {
    expect(
      rosterFloorRefusal({
        gate: GATE,
        resolution: { kind: "resolved", roster: FLOOR, source: "byGate" },
        lenses: [...FLOOR, "rin-naming-reviewer-agent"],
      }),
    ).toBeNull();
  });

  test("refuses an uncovered floor, naming the missing lenses and the source", () => {
    const refusal = rosterFloorRefusal({
      gate: GATE,
      resolution: { kind: "resolved", roster: FLOOR, source: "defaultRoster" },
      lenses: ["aidlc-architecture-reviewer-agent"],
    });
    expect(refusal).toContain("misses roster lenses");
    expect(refusal).toContain("rin-clean-architecture-reviewer-agent");
    expect(refusal).toContain("defaultRoster");
    expect(refusal).toContain(GATE);
  });

  test("refuses a verdict naming no lenses against a real floor", () => {
    expect(
      rosterFloorRefusal({
        gate: GATE,
        resolution: { kind: "resolved", roster: FLOOR, source: "byGate" },
        lenses: [],
      }),
    ).toContain("misses roster lenses");
  });

  // The fail-open this Slice closes: an unreadable config once resolved to `[]`,
  // and `[].every(...)` is vacuously true, so the floor silently vanished.
  test("refuses when the roster cannot be resolved at all", () => {
    const refusal = rosterFloorRefusal({
      gate: GATE,
      resolution: {
        kind: "unreadable",
        reason: "config is not parseable JSON",
      },
      lenses: [...FLOOR],
    });
    expect(refusal).toContain("cannot resolve the review roster");
    expect(refusal).toContain("config is not parseable JSON");
  });

  test("an unreadable roster refuses even a verdict naming many lenses", () => {
    expect(
      rosterFloorRefusal({
        gate: GATE,
        resolution: {
          kind: "unreadable",
          reason: "does not contain a JSON object",
        },
        lenses: [...FLOOR, "rin-naming-reviewer-agent"],
      }),
    ).toContain("cannot resolve the review roster");
  });
});

describe("rin-gates-autonomy-gate phaseOfGate — total over the rin-gate-* vocabulary", () => {
  test("maps every composed rin-gate-* slug to its phase (the M8 regression)", () => {
    expect(phaseOfGate("rin-gate-0-reconcile")).toBe("inception");
    expect(phaseOfGate("rin-gate-1-framing")).toBe("inception");
    expect(phaseOfGate("rin-gate-2-plan-review")).toBe("inception");
    expect(phaseOfGate("rin-gate-3-interface-lock")).toBe("inception");
    expect(phaseOfGate("rin-gate-4-implement")).toBe("construction");
    expect(phaseOfGate("rin-gate-5-review-cycle")).toBe("construction");
    expect(phaseOfGate("rin-gate-6-operate")).toBe("operation");
  });

  test("rejects the retired bare gate-* slug — one vocabulary, no normalisation", () => {
    expect(phaseOfGate("gate-0-reconcile")).toBeNull();
    expect(phaseOfGate("gate-4-implement")).toBeNull();
    expect(phaseOfGate("gate-6-operate")).toBeNull();
  });

  test("returns null for an unmappable slug", () => {
    expect(phaseOfGate("rin-gate-9-nonexistent")).toBeNull();
    expect(phaseOfGate("not-a-gate")).toBeNull();
  });
});

describe("rin-gates-autonomy-gate verdictPath — the gate slug names its own dir", () => {
  test("resolves a rin-gate-* slug to the identically-named verdict dir", () => {
    expect(verdictPath("/record", "rin-gate-0-reconcile")).toBe(
      join(
        "/record",
        "inception",
        "rin-gate-0-reconcile",
        "review-verdict.json",
      ),
    );
  });

  test("returns null for a retired bare slug", () => {
    expect(verdictPath("/record", "gate-0-reconcile")).toBeNull();
  });

  test("returns null for an unmappable slug", () => {
    expect(verdictPath("/record", "not-a-gate")).toBeNull();
  });
});
