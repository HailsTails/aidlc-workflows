import { describe, expect, test } from "vitest";
import { resolveRoster } from "./rin-gates-review-roster";

const config = {
  defaultRoster: [
    "aidlc-architecture-reviewer-agent",
    "rin-clean-architecture-reviewer-agent",
    "rin-ddd-modelling-reviewer-agent",
    "rin-decomposition-reviewer-agent",
  ],
  byGate: {
    "rin-gate-5-review-cycle": [
      "rin-pr-checkers-reviewer-agent",
      "rin-intent-defense-reviewer-agent",
    ],
    "rin-gate-9-empty": [],
  },
};

describe("resolveRoster", () => {
  test("falls back to the default roster for a gate absent from byGate", () => {
    const resolution = resolveRoster({ rawGate: "rin-gate-1-framing", config });
    expect(resolution).toEqual({
      kind: "resolved",
      gate: "rin-gate-1-framing",
      roster: config.defaultRoster,
      source: "defaultRoster",
    });
  });

  test("uses the declared roster for a gate present in byGate", () => {
    const resolution = resolveRoster({
      rawGate: "rin-gate-5-review-cycle",
      config,
    });
    expect(resolution).toEqual({
      kind: "resolved",
      gate: "rin-gate-5-review-cycle",
      roster: config.byGate["rin-gate-5-review-cycle"],
      source: "byGate",
    });
  });

  test("does not resolve a retired bare gate-* slug onto a declared roster", () => {
    const resolution = resolveRoster({
      rawGate: "gate-5-review-cycle",
      config,
    });
    expect(resolution).toEqual({
      kind: "resolved",
      gate: "gate-5-review-cycle",
      roster: config.defaultRoster,
      source: "defaultRoster",
    });
  });

  test("falls back to the default roster when a byGate entry is empty", () => {
    const resolution = resolveRoster({ rawGate: "rin-gate-9-empty", config });
    expect(resolution).toEqual({
      kind: "resolved",
      gate: "rin-gate-9-empty",
      roster: config.defaultRoster,
      source: "defaultRoster",
    });
  });

  test("reports no-gate when no gate could be resolved", () => {
    const resolution = resolveRoster({ rawGate: null, config });
    expect(resolution.kind).toBe("no-gate");
  });
});
