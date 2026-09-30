import { describe, expect, test } from "vitest";
import {
  admitReviewer,
  BOARD_COORDINATOR,
  checkReviewerTotality,
  declaredReviewerFor,
  rinGateReviewersIn,
} from "./rin-gates-reviewer-identity";

describe("admitReviewer", () => {
  test("admits a reviewer that is a member of the gate's resolved roster", () => {
    expect(
      admitReviewer({ reviewer: "lens-a", roster: ["lens-a", "lens-b"] }),
    ).toEqual({ kind: "admitted", via: "roster" });
  });

  test("admits the board coordinator, which by definition never runs as a lens", () => {
    expect(
      admitReviewer({ reviewer: BOARD_COORDINATOR, roster: ["lens-a"] }),
    ).toEqual({
      kind: "admitted",
      via: "board-coordinator",
    });
  });

  test("reports divergence for an identity no review process at that gate can produce", () => {
    expect(
      admitReviewer({
        reviewer: "aidlc-product-lead-agent",
        roster: ["lens-a"],
      }),
    ).toEqual({ kind: "divergent", roster: ["lens-a"] });
  });
});

describe("rinGateReviewersIn", () => {
  test("selects only nodes scoped to rin-gates that declare a reviewer", () => {
    const graph = [
      {
        slug: "rin-gate-0-reconcile",
        scopes: ["rin-gates"],
        reviewer: "lens-a",
      },
      { slug: "rin-gate-9-silent", scopes: ["rin-gates"] },
      { slug: "code-generation", scopes: ["mvp"], reviewer: "lens-b" },
    ];
    expect(rinGateReviewersIn(graph)).toEqual([
      { gate: "rin-gate-0-reconcile", reviewer: "lens-a" },
    ]);
  });

  test("yields nothing for a graph that is not an array", () => {
    expect(rinGateReviewersIn(null)).toEqual([]);
  });
});

describe("declaredReviewerFor", () => {
  test("reads the reviewer from the graph rather than any local table", () => {
    const graph = [
      {
        slug: "rin-gate-5-review-cycle",
        scopes: ["rin-gates"],
        reviewer: BOARD_COORDINATOR,
      },
    ];
    expect(
      declaredReviewerFor({ gate: "rin-gate-5-review-cycle", graph }),
    ).toBe(BOARD_COORDINATOR);
  });

  test("returns null for a gate the graph does not declare", () => {
    expect(
      declaredReviewerFor({ gate: "rin-gate-absent", graph: [] }),
    ).toBeNull();
  });
});

describe("checkReviewerTotality", () => {
  test("reports empty-scan rather than success when it resolves no gates", () => {
    expect(
      checkReviewerTotality({ gateReviewers: [], rosterFor: () => ["lens-a"] }),
    ).toEqual({ kind: "empty-scan" });
  });

  test("reports the diverging gate, its reviewer, and the roster it left", () => {
    const result = checkReviewerTotality({
      gateReviewers: [
        { gate: "rin-gate-0-reconcile", reviewer: "lens-a" },
        { gate: "rin-gate-1-framing", reviewer: "stranger-agent" },
      ],
      rosterFor: () => ["lens-a"],
    });
    expect(result).toEqual({
      kind: "divergent",
      findings: [
        {
          gate: "rin-gate-1-framing",
          reviewer: "stranger-agent",
          roster: ["lens-a"],
        },
      ],
    });
  });

  test("is total when every gate's reviewer is admissible", () => {
    expect(
      checkReviewerTotality({
        gateReviewers: [
          { gate: "rin-gate-0-reconcile", reviewer: "lens-a" },
          { gate: "rin-gate-3-interface-lock", reviewer: BOARD_COORDINATOR },
        ],
        rosterFor: () => ["lens-a"],
      }),
    ).toEqual({ kind: "total", gatesChecked: 2 });
  });
});
