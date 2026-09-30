import { describe, expect, test } from "vitest";
import type {
  MetaTier,
  WritableImportanceBinding,
} from "./rin-gates-importance-binding.ts";
import {
  parseRebindRequest,
  type RebindPorts,
  rebindTier,
  renderRebindFailure,
  renderRebindOutcome,
} from "./rin-gates-tier-rebind.ts";

const BOUND_AT = "2026-09-04T00:00:00.000Z";

const bindingJson = (args: {
  readonly milestone: WritableImportanceBinding["milestone"];
  readonly tier?: MetaTier;
}): string =>
  JSON.stringify({
    flagged: "not-flagged",
    milestone: args.milestone,
    boundAt: "2026-08-01T00:00:00.000Z",
    boundBy: "gate-0-reconcile",
    ...(args.tier === undefined ? {} : { tier: args.tier }),
  });

const portsOver = (args: {
  readonly raw: string | null;
  readonly writes: WritableImportanceBinding[];
  readonly readFails?: boolean;
  readonly writeFails?: boolean;
}): RebindPorts => ({
  readBinding: () =>
    args.readFails === true
      ? { outcome: "failed", error: "absent" }
      : { outcome: "ok", value: args.raw },
  readTier: () => ({ kind: "unscored" }),
  writeImportanceBinding: ({ binding }) => {
    if (args.writeFails === true) {
      return {
        outcome: "failed",
        error: { kind: "write-failed", recordDirName: "r", detail: "disk" },
      };
    }
    args.writes.push(binding);
    return { outcome: "ok", value: "replaced" };
  },
});

describe("rebindTier writes a scored tier onto an existing binding", () => {
  test("a no-milestone record takes the tier and preserves flag and milestone", () => {
    const writes: WritableImportanceBinding[] = [];
    const result = rebindTier({
      request: {
        recordDirName: "260811-x",
        tier: "T1",
        evidence: "derivation-5",
      },
      ports: portsOver({
        raw: bindingJson({ milestone: { kind: "no-milestone" } }),
        writes,
      }),
      ratifiedMilestones: ["M1"],
      boundAt: BOUND_AT,
    });

    expect(result.outcome).toBe("ok");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.tier).toEqual({ kind: "scored", value: "T1" });
    expect(writes[0]?.flagged).toBe("not-flagged");
    expect(writes[0]?.milestone).toEqual({ kind: "no-milestone" });
  });

  test("the rebind is attributed and timestamped, so provenance names the evidence", () => {
    const writes: WritableImportanceBinding[] = [];
    rebindTier({
      request: {
        recordDirName: "260811-x",
        tier: "T3",
        evidence: "derivation-5",
      },
      ports: portsOver({
        raw: bindingJson({ milestone: { kind: "no-milestone" } }),
        writes,
      }),
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(writes[0]?.boundBy).toBe("tier-rebind:derivation-5");
    expect(writes[0]?.boundAt).toBe(BOUND_AT);
  });

  test("the outgoing tier is read BEFORE the write, so a rebind does not render as a no-op", () => {
    const writes: WritableImportanceBinding[] = [];
    const reads: string[] = [];
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T1", evidence: "e" },
      ports: {
        readBinding: () => ({
          outcome: "ok",
          value: bindingJson({ milestone: { kind: "no-milestone" } }),
        }),
        readTier: () => {
          reads.push(writes.length === 0 ? "before-write" : "after-write");
          return { kind: "unscored" };
        },
        writeImportanceBinding: ({ binding }) => {
          writes.push(binding);
          return { outcome: "ok", value: "replaced" };
        },
      },
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(reads).toEqual(["before-write"]);
    expect(result.outcome === "ok" && result.value.previous).toEqual({
      kind: "unscored",
    });
  });

  test("a ratified-milestone record IS rebound — a per-record binding is never refused", () => {
    const writes: WritableImportanceBinding[] = [];
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T0", evidence: "e" },
      ports: portsOver({
        raw: bindingJson({
          milestone: { kind: "milestone", identifier: "M1" },
        }),
        writes,
      }),
      ratifiedMilestones: ["M1"],
      boundAt: BOUND_AT,
    });

    expect(result.outcome).toBe("ok");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.tier).toEqual({ kind: "scored", value: "T0" });
    expect(writes[0]?.milestone).toEqual({
      kind: "milestone",
      identifier: "M1",
    });
  });

  test("scoring a milestone-bound record is REPORTED, so the meta-work rule is visible not silent", () => {
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T0", evidence: "e" },
      ports: portsOver({
        raw: bindingJson({
          milestone: { kind: "milestone", identifier: "M1" },
        }),
        writes: [],
      }),
      ratifiedMilestones: ["M1"],
      boundAt: BOUND_AT,
    });

    expect(result.outcome === "ok" && result.value.note).toEqual({
      kind: "milestone-bound-record-scored",
      milestone: "M1",
      tier: "T0",
    });
  });

  test("a no-milestone rebind carries no note — the ordinary path stays quiet", () => {
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T3", evidence: "e" },
      ports: portsOver({
        raw: bindingJson({ milestone: { kind: "no-milestone" } }),
        writes: [],
      }),
      ratifiedMilestones: ["M1"],
      boundAt: BOUND_AT,
    });

    expect(result.outcome === "ok" && result.value.note).toEqual({
      kind: "none",
    });
  });

  test("an unratified milestone carries no note — the rule names ratified milestones", () => {
    const writes: WritableImportanceBinding[] = [];
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T2", evidence: "e" },
      ports: portsOver({
        raw: bindingJson({
          milestone: { kind: "milestone", identifier: "M9" },
        }),
        writes,
      }),
      ratifiedMilestones: ["M1"],
      boundAt: BOUND_AT,
    });

    expect(result.outcome).toBe("ok");
    expect(writes).toHaveLength(1);
  });
});

describe("rebindTier refuses rather than corrupting state", () => {
  test("an unbound record is refused as unbound, not silently minted", () => {
    const writes: WritableImportanceBinding[] = [];
    const result = rebindTier({
      request: { recordDirName: "260701-poc", tier: "T3", evidence: "e" },
      ports: portsOver({ raw: null, writes }),
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(result.outcome).toBe("failed");
    expect(result.outcome === "failed" && result.error.kind).toBe(
      "record-unbound",
    );
    expect(writes).toHaveLength(0);
  });

  test("a malformed binding reads as unbound and is refused, never overwritten", () => {
    const writes: WritableImportanceBinding[] = [];
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T3", evidence: "e" },
      ports: portsOver({ raw: "{ not json", writes }),
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(result.outcome === "failed" && result.error.kind).toBe(
      "record-unbound",
    );
    expect(writes).toHaveLength(0);
  });

  test("an absent record directory is refused", () => {
    const result = rebindTier({
      request: { recordDirName: "nope", tier: "T3", evidence: "e" },
      ports: portsOver({ raw: null, writes: [], readFails: true }),
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(result.outcome === "failed" && result.error.kind).toBe(
      "record-dir-absent",
    );
  });

  test("a failed write surfaces as a failure rather than a reported success", () => {
    const result = rebindTier({
      request: { recordDirName: "260811-x", tier: "T3", evidence: "e" },
      ports: portsOver({
        raw: bindingJson({ milestone: { kind: "no-milestone" } }),
        writes: [],
        writeFails: true,
      }),
      ratifiedMilestones: [],
      boundAt: BOUND_AT,
    });

    expect(result.outcome === "failed" && result.error.kind).toBe(
      "binding-write-failed",
    );
  });
});

describe("parseRebindRequest requires every argument explicitly", () => {
  const flagsOf =
    (map: Record<string, string>) =>
    (flag: string): string | undefined =>
      map[flag];

  test("a complete request parses", () => {
    const result = parseRebindRequest({
      flagValue: flagsOf({
        "--record": "260811-x",
        "--tier": "T1",
        "--evidence": "d5",
      }),
    });

    expect(result).toEqual({
      outcome: "ok",
      value: { recordDirName: "260811-x", tier: "T1", evidence: "d5" },
    });
  });

  test("evidence is required — a tier with no pointer to its derivation is refused", () => {
    const result = parseRebindRequest({
      flagValue: flagsOf({ "--record": "260811-x", "--tier": "T1" }),
    });

    expect(result.outcome === "failed" && result.error).toEqual({
      kind: "missing-argument",
      flag: "--evidence",
    });
  });

  test("an unknown tier token is refused by value, not coerced", () => {
    const result = parseRebindRequest({
      flagValue: flagsOf({
        "--record": "r",
        "--tier": "T9",
        "--evidence": "d",
      }),
    });

    expect(result.outcome === "failed" && result.error).toEqual({
      kind: "unknown-tier",
      received: "T9",
    });
  });

  test("`unscored` is not an acceptable tier — the ban is enforced at the parser", () => {
    const result = parseRebindRequest({
      flagValue: flagsOf({
        "--record": "r",
        "--tier": "unscored",
        "--evidence": "d",
      }),
    });

    expect(result.outcome === "failed" && result.error).toEqual({
      kind: "unknown-tier",
      received: "unscored",
    });
  });
});

describe("renderRebindFailure names the distinction the caller must act on", () => {
  test("unbound is explained as different from unscored", () => {
    expect(
      renderRebindFailure({
        kind: "record-unbound",
        recordDirName: "260701-poc",
      }),
    ).toContain("unbound, not unscored");
  });

  test("an unknown tier lists the permitted set rather than only rejecting", () => {
    const rendered = renderRebindFailure({
      kind: "unknown-tier",
      received: "unscored",
    });

    expect(rendered).toContain("T0");
    expect(rendered).toContain("T3");
  });
});

describe("renderRebindOutcome surfaces the meta-work note in the rendered line", () => {
  test("a milestone-bound rebind renders its note", () => {
    const rendered = renderRebindOutcome({
      recordDirName: "260811-x",
      previous: { kind: "unscored" },
      rebound: "T0",
      write: "replaced",
      note: {
        kind: "milestone-bound-record-scored",
        milestone: "M1",
        tier: "T0",
      },
    });

    expect(rendered).toContain("M1");
    expect(rendered).toContain("meta-work rule");
  });

  test("an ordinary rebind renders no note", () => {
    const rendered = renderRebindOutcome({
      recordDirName: "260811-x",
      previous: { kind: "unscored" },
      rebound: "T3",
      write: "replaced",
      note: { kind: "none" },
    });

    expect(rendered).toBe("rebound 260811-x: unscored → T3 (replaced)");
  });
});
