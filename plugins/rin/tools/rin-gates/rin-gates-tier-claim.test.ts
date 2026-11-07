import { describe, expect, test } from "vitest";
import { assessTierClaim, parseTierClaim } from "./rin-gates-tier-claim.ts";

const completePricedIncident = {
  kind: "priced-incident",
  currency: "AUD",
  amount: "1200",
  evidence: "PR #612 postmortem",
} as const;

const completeMeasuredRecurrence = {
  kind: "measured-recurrence",
  perOccurrenceCost: "8 min",
  occurrences: "45",
  denominator: "116 sessions",
  evidence: "gate-evidence ritual retirement",
} as const;

describe("assessTierClaim — a complete claim keeps its claimed tier", () => {
  test("a complete priced-incident claim is assessed at the claimed tier with nothing missing", () => {
    expect(
      assessTierClaim({ claimed: "T1", claim: completePricedIncident }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T1",
      missing: [],
      checkedProperty: "completeness",
    });
  });

  test("a complete measured-recurrence claim is NOT demoted — the operator's looping-friction ruling", () => {
    expect(
      assessTierClaim({ claimed: "T1", claim: completeMeasuredRecurrence }),
    ).toEqual({
      kind: "measured-recurrence",
      assessed: "T1",
      missing: [],
      checkedProperty: "completeness",
    });
  });

  test("a complete claim at T0 keeps T0", () => {
    expect(
      assessTierClaim({ claimed: "T0", claim: completePricedIncident }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T0",
      missing: [],
      checkedProperty: "completeness",
    });
  });
});

describe("assessTierClaim — an incomplete claim demotes to T3 and names what was absent", () => {
  test("a priced-incident claim missing its currency demotes and names currency", () => {
    expect(
      assessTierClaim({
        claimed: "T1",
        claim: { ...completePricedIncident, currency: null },
      }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T3",
      missing: ["currency"],
      checkedProperty: "completeness",
    });
  });

  test("a priced-incident claim missing every component names all three in order", () => {
    expect(
      assessTierClaim({
        claimed: "T0",
        claim: {
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        },
      }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T3",
      missing: ["currency", "amount", "evidence"],
      checkedProperty: "completeness",
    });
  });

  test("a measured-recurrence claim missing its denominator demotes and names denominator", () => {
    expect(
      assessTierClaim({
        claimed: "T1",
        claim: { ...completeMeasuredRecurrence, denominator: null },
      }),
    ).toEqual({
      kind: "measured-recurrence",
      assessed: "T3",
      missing: ["denominator"],
      checkedProperty: "completeness",
    });
  });

  test("a measured-recurrence claim missing every component names all four in order", () => {
    expect(
      assessTierClaim({
        claimed: "T2",
        claim: {
          kind: "measured-recurrence",
          perOccurrenceCost: null,
          occurrences: null,
          denominator: null,
          evidence: null,
        },
      }),
    ).toEqual({
      kind: "measured-recurrence",
      assessed: "T3",
      missing: ["perOccurrenceCost", "occurrences", "denominator", "evidence"],
      checkedProperty: "completeness",
    });
  });

  test("an empty-string component counts as absent, not as a named value", () => {
    expect(
      assessTierClaim({
        claimed: "T1",
        claim: { ...completePricedIncident, amount: "" },
      }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T3",
      missing: ["amount"],
      checkedProperty: "completeness",
    });
  });
});

describe("assessTierClaim — T3 is the floor and is never demoted", () => {
  test("an incomplete priced-incident claim of T3 stays T3 while still naming what was absent", () => {
    expect(
      assessTierClaim({
        claimed: "T3",
        claim: {
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        },
      }),
    ).toEqual({
      kind: "priced-incident",
      assessed: "T3",
      missing: ["currency", "amount", "evidence"],
      checkedProperty: "completeness",
    });
  });

  test("an incomplete measured-recurrence claim of T3 stays T3", () => {
    expect(
      assessTierClaim({
        claimed: "T3",
        claim: { ...completeMeasuredRecurrence, evidence: null },
      }),
    ).toEqual({
      kind: "measured-recurrence",
      assessed: "T3",
      missing: ["evidence"],
      checkedProperty: "completeness",
    });
  });
});

describe("assessTierClaim — each claim kind yields its OWN assessment kind", () => {
  test("a priced-incident claim yields a priced-incident assessment", () => {
    expect(
      assessTierClaim({ claimed: "T1", claim: completePricedIncident }).kind,
    ).toBe("priced-incident");
  });

  test("a measured-recurrence claim yields a measured-recurrence assessment", () => {
    expect(
      assessTierClaim({ claimed: "T1", claim: completeMeasuredRecurrence })
        .kind,
    ).toBe("measured-recurrence");
  });

  test("an incomplete claim still yields its own kind rather than falling to the other", () => {
    expect(
      assessTierClaim({
        claimed: "T1",
        claim: { ...completeMeasuredRecurrence, occurrences: null },
      }).kind,
    ).toBe("measured-recurrence");
  });
});

describe("assessTierClaim — demotion is read from assessed, never from a boolean", () => {
  test("a demoted assessment reports assessed differing from claimed", () => {
    const assessment = assessTierClaim({
      claimed: "T1",
      claim: { ...completePricedIncident, evidence: null },
    });
    expect(assessment.assessed).not.toBe("T1");
    expect(assessment.assessed).toBe("T3");
  });

  test("an undemoted assessment reports assessed equal to claimed", () => {
    const assessment = assessTierClaim({
      claimed: "T2",
      claim: completePricedIncident,
    });
    expect(assessment.assessed).toBe("T2");
    expect(assessment.missing).toEqual([]);
  });
});

describe("parseTierClaim — the boundary parse, Zod-validated once (CD-4/CD-45)", () => {
  test("parses a complete priced-incident claim", () => {
    expect(
      parseTierClaim({ raw: JSON.stringify(completePricedIncident) }),
    ).toEqual({ outcome: "ok", value: completePricedIncident });
  });

  test("parses a complete measured-recurrence claim", () => {
    expect(
      parseTierClaim({ raw: JSON.stringify(completeMeasuredRecurrence) }),
    ).toEqual({ outcome: "ok", value: completeMeasuredRecurrence });
  });

  test("parses a claim with null components — nulls are the incompleteness signal, not malformation", () => {
    expect(
      parseTierClaim({
        raw: JSON.stringify({
          kind: "priced-incident",
          currency: null,
          amount: null,
          evidence: null,
        }),
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        kind: "priced-incident",
        currency: null,
        amount: null,
        evidence: null,
      },
    });
  });

  test("REFUSES invalid JSON as malformed-tier-claim rather than throwing", () => {
    expect(parseTierClaim({ raw: "not json" })).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });

  test("REFUSES an unrecognised claim kind", () => {
    expect(
      parseTierClaim({
        raw: JSON.stringify({ kind: "guessed", evidence: "vibes" }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });

  test("REFUSES a priced-incident claim missing a required key entirely (not merely null)", () => {
    expect(
      parseTierClaim({
        raw: JSON.stringify({ kind: "priced-incident", currency: "AUD" }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });

  test("REFUSES a measured-recurrence claim missing a required key entirely", () => {
    expect(
      parseTierClaim({
        raw: JSON.stringify({
          kind: "measured-recurrence",
          perOccurrenceCost: "8 min",
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });

  test("REFUSES a top-level JSON array", () => {
    expect(parseTierClaim({ raw: "[]" })).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });

  test("REFUSES a non-string, non-null component value", () => {
    expect(
      parseTierClaim({
        raw: JSON.stringify({
          kind: "priced-incident",
          currency: "AUD",
          amount: 1200,
          evidence: "PR #612 postmortem",
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "malformed-tier-claim" },
    });
  });
});
