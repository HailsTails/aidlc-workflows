import { describe, expect, test } from "vitest";
import {
  coverageOf,
  parseImportanceBinding,
  parseMetaTier,
  readMetaTierWithAnomaly,
  readTierKey,
  tierCarrierAccepts,
  violatesMilestoneTierExclusion,
} from "./rin-gates-importance-binding.ts";

const validBinding = {
  flagged: "operator-flagged",
  milestone: { kind: "milestone", identifier: "M5" },
  boundAt: "2026-08-16T09:00:00Z",
  boundBy: "operator",
};

describe("parseImportanceBinding (IF-1 — total, never Result-returning)", () => {
  test("an absent artefact reads as unbound", () => {
    expect(parseImportanceBinding({ raw: null })).toBe("unbound");
  });

  test("an empty artefact reads as unbound", () => {
    expect(parseImportanceBinding({ raw: "" })).toBe("unbound");
  });

  test("unparseable JSON reads as unbound", () => {
    expect(parseImportanceBinding({ raw: "{not json" })).toBe("unbound");
  });

  test("JSON of the wrong shape reads as unbound", () => {
    expect(parseImportanceBinding({ raw: '{"flagged":"yes"}' })).toBe(
      "unbound",
    );
  });

  test("an unknown flag value reads as unbound", () => {
    expect(
      parseImportanceBinding({
        raw: JSON.stringify({ ...validBinding, flagged: "urgent" }),
      }),
    ).toBe("unbound");
  });

  test("a valid binding parses to its fields", () => {
    expect(
      parseImportanceBinding({ raw: JSON.stringify(validBinding) }),
    ).toEqual(validBinding);
  });

  test("a milestone identifier of literally 'no-milestone' parses as a milestone, not the state", () => {
    const parsed = parseImportanceBinding({
      raw: JSON.stringify({
        ...validBinding,
        milestone: { kind: "milestone", identifier: "no-milestone" },
      }),
    });
    expect(parsed).not.toBe("unbound");
    expect(parsed === "unbound" ? null : parsed.milestone).toEqual({
      kind: "milestone",
      identifier: "no-milestone",
    });
  });

  test("the explicit no-milestone state parses as that state", () => {
    const parsed = parseImportanceBinding({
      raw: JSON.stringify({
        ...validBinding,
        milestone: { kind: "no-milestone" },
      }),
    });
    expect(parsed === "unbound" ? null : parsed.milestone).toEqual({
      kind: "no-milestone",
    });
  });
});

describe("parseMetaTier (IF-3 — total, fail-closed, a second independent step)", () => {
  test("a recognised scored tier parses to that member", () => {
    expect(
      parseMetaTier({
        parsed: { ...validBinding, tier: { kind: "scored", value: "T1" } },
      }),
    ).toEqual({ kind: "scored", value: "T1" });
  });

  test("T0 parses to itself", () => {
    expect(
      parseMetaTier({ parsed: { tier: { kind: "scored", value: "T0" } } }),
    ).toEqual({ kind: "scored", value: "T0" });
  });

  test("T2 parses to itself", () => {
    expect(
      parseMetaTier({ parsed: { tier: { kind: "scored", value: "T2" } } }),
    ).toEqual({ kind: "scored", value: "T2" });
  });

  test("T3 parses to itself", () => {
    expect(
      parseMetaTier({ parsed: { tier: { kind: "scored", value: "T3" } } }),
    ).toEqual({ kind: "scored", value: "T3" });
  });

  test("the explicit unscored member parses to itself", () => {
    expect(parseMetaTier({ parsed: { tier: { kind: "unscored" } } })).toEqual({
      kind: "unscored",
    });
  });

  test("an absent tier key reads as unscored — the back-compat path", () => {
    expect(parseMetaTier({ parsed: validBinding })).toEqual({
      kind: "unscored",
    });
  });

  test("an unrecognised tier value reads as unscored, never a scored tier", () => {
    expect(
      parseMetaTier({ parsed: { tier: { kind: "scored", value: "T9" } } }),
    ).toEqual({ kind: "unscored" });
  });

  test("a tier of the wrong shape reads as unscored", () => {
    expect(parseMetaTier({ parsed: { tier: "T1" } })).toEqual({
      kind: "unscored",
    });
  });

  test("a string reads as unscored", () => {
    expect(parseMetaTier({ parsed: "a string" })).toEqual({ kind: "unscored" });
  });

  test("null reads as unscored", () => {
    expect(parseMetaTier({ parsed: null })).toEqual({ kind: "unscored" });
  });
});

describe("readTierKey (IF-3 — the carrier extraction, total and cast-free)", () => {
  test("a binding with NO tier key yields undefined through the carrier's SUCCESS branch", () => {
    expect(tierCarrierAccepts({ parsed: validBinding })).toBe(true);
    expect(readTierKey({ parsed: validBinding })).toBeUndefined();
  });

  test("a non-object is refused by the carrier rather than yielding a value", () => {
    expect(tierCarrierAccepts({ parsed: "a string" })).toBe(false);
    expect(readTierKey({ parsed: "a string" })).toBeUndefined();
  });

  test("a present tier key is extracted without being asserted", () => {
    expect(
      readTierKey({ parsed: { tier: { kind: "scored", value: "T1" } } }),
    ).toEqual({ kind: "scored", value: "T1" });
  });
});

describe("the host parse is untouched by a tier key (IF-3 point 1)", () => {
  test("a binding carrying a tier key still parses to its four ratified fields", () => {
    expect(
      parseImportanceBinding({
        raw: JSON.stringify({
          ...validBinding,
          tier: { kind: "scored", value: "T1" },
        }),
      }),
    ).toEqual(validBinding);
  });

  test("an unrecognised tier key never collapses the binding to unbound", () => {
    expect(
      parseImportanceBinding({
        raw: JSON.stringify({ ...validBinding, tier: "nonsense" }),
      }),
    ).toEqual(validBinding);
  });
});

// Both members asserted by EXACT SHAPE. A truthy check would accept a malformed
// anomaly, and the `{ kind: "none" }` cases are the ones a defect-only test omits
// — they are what catch a spurious anomaly raised on valid input.
describe("readMetaTierWithAnomaly (IF-3) — the anomaly channel", () => {
  test("an unrecognised tier reports the anomaly and still reads unscored", () => {
    expect(
      readMetaTierWithAnomaly({ parsed: { ...validBinding, tier: "T9" } }),
    ).toEqual({
      tier: { kind: "unscored" },
      anomaly: { kind: "unrecognised-tier", received: '"T9"' },
    });
  });

  test("a wrong-shaped tier reports the anomaly rather than vanishing it", () => {
    expect(
      readMetaTierWithAnomaly({
        parsed: { ...validBinding, tier: { kind: "scored" } },
      }),
    ).toEqual({
      tier: { kind: "unscored" },
      anomaly: {
        kind: "unrecognised-tier",
        received: '{"kind":"scored"}',
      },
    });
  });

  test("a well-formed scored tier reports NO anomaly", () => {
    expect(
      readMetaTierWithAnomaly({
        parsed: { ...validBinding, tier: { kind: "scored", value: "T1" } },
      }),
    ).toEqual({
      tier: { kind: "scored", value: "T1" },
      anomaly: { kind: "none" },
    });
  });

  test("an ABSENT tier key reports NO anomaly — the 302-artefact path", () => {
    expect(readMetaTierWithAnomaly({ parsed: validBinding })).toEqual({
      tier: { kind: "unscored" },
      anomaly: { kind: "none" },
    });
  });

  test("the explicit unscored member reports NO anomaly", () => {
    expect(
      readMetaTierWithAnomaly({
        parsed: { ...validBinding, tier: { kind: "unscored" } },
      }),
    ).toEqual({ tier: { kind: "unscored" }, anomaly: { kind: "none" } });
  });
});

describe("violatesMilestoneTierExclusion (IF-2, FR-4)", () => {
  test("a ratified milestone with a scored tier violates", () => {
    expect(
      violatesMilestoneTierExclusion({
        milestoneIsRatified: true,
        tier: { kind: "scored", value: "T1" },
      }),
    ).toBe(true);
  });

  test("a ratified milestone with an unscored tier does not violate", () => {
    expect(
      violatesMilestoneTierExclusion({
        milestoneIsRatified: true,
        tier: { kind: "unscored" },
      }),
    ).toBe(false);
  });

  test("an unratified milestone with a scored tier does not violate", () => {
    expect(
      violatesMilestoneTierExclusion({
        milestoneIsRatified: false,
        tier: { kind: "scored", value: "T0" },
      }),
    ).toBe(false);
  });
});

describe("coverageOf (IF-8)", () => {
  test("an unbound record classifies unbound", () => {
    expect(coverageOf({ binding: "unbound" })).toBe("unbound");
  });

  test("a parsed binding classifies bound", () => {
    const parsed = parseImportanceBinding({
      raw: JSON.stringify(validBinding),
    });
    expect(coverageOf({ binding: parsed })).toBe("bound");
  });
});
