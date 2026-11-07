// The binding-normalisation and records-only-drift units of the autonomy gate
// (Slice 260816-verdict-landed-binding, IF-13). Both are pure over their inputs
// — no git, no fs, no env — so the subprocess-level derivation selftest proves
// the composed deny paths and these prove the decisions those paths make.

import { describe, expect, test } from "vitest";
import {
  bindingOf,
  type ReviewVerdict,
  recordsOnlyDriftVerdictOf,
} from "./rin-gates-autonomy-gate.ts";

const HEAD_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const MERGE_COMMIT = "cafe0000cafe0000cafe0000cafe0000cafe0000";
const REVIEWED_HEAD = "beef1111beef1111beef1111beef1111beef1111";
const DIGEST = "9f".repeat(32);

const verdictWith = (extra: Record<string, unknown>): ReviewVerdict => ({
  gate: "rin-gate-5-review-cycle",
  verdict: "READY",
  lenses: ["rin-pr-constitution-lens"],
  emittedBy: "rin-gates-review-verdict",
  ...extra,
});

const RECORD_PREFIX =
  "aidlc/spaces/default/intents/260816-verdict-landed-binding/";

describe("bindingOf reads a binding-less verdict as live", () => {
  test("a verdict with headSha and no binding normalises to a live binding", () => {
    expect(bindingOf({ verdict: verdictWith({ headSha: HEAD_SHA }) })).toEqual({
      outcome: "ok",
      value: { mode: "live", headSha: HEAD_SHA },
    });
  });

  test("a verdict with neither binding nor headSha is named, not guessed", () => {
    expect(bindingOf({ verdict: verdictWith({}) })).toEqual({
      outcome: "failed",
      error: { kind: "binding-absent-and-no-head-sha" },
    });
  });

  test("a non-string headSha is not accepted as a live binding", () => {
    expect(bindingOf({ verdict: verdictWith({ headSha: 42 }) })).toEqual({
      outcome: "failed",
      error: { kind: "binding-absent-and-no-head-sha" },
    });
  });
});

describe("bindingOf reads an explicit live binding", () => {
  test("mode live with a string headSha succeeds", () => {
    const verdict = verdictWith({
      headSha: HEAD_SHA,
      binding: { mode: "live", headSha: HEAD_SHA },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "ok",
      value: { mode: "live", headSha: HEAD_SHA },
    });
  });

  test("the binding wins over a disagreeing top-level headSha", () => {
    const verdict = verdictWith({
      headSha: "0000000000000000",
      binding: { mode: "live", headSha: HEAD_SHA },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "ok",
      value: { mode: "live", headSha: HEAD_SHA },
    });
  });

  test("mode live with no headSha names the missing field", () => {
    const verdict = verdictWith({ binding: { mode: "live" } });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "live",
        missing: ["headSha"],
      },
    });
  });

  test("mode live with an ill-typed headSha is rejected, not merely an absent one", () => {
    const verdict = verdictWith({
      headSha: HEAD_SHA,
      binding: { mode: "live", headSha: 42 },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "live",
        missing: ["headSha"],
      },
    });
  });

  test("mode live with a null headSha does not fall back to the top-level headSha", () => {
    const verdict = verdictWith({
      headSha: HEAD_SHA,
      binding: { mode: "live", headSha: null },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "live",
        missing: ["headSha"],
      },
    });
  });
});

describe("bindingOf reads a landed binding", () => {
  const wellFormed = {
    mode: "landed",
    pullRequestNumber: 561,
    reviewedHeadSha: REVIEWED_HEAD,
    mergeCommitSha: MERGE_COMMIT,
    diffDigest: DIGEST,
  };

  test("all four fields well-typed succeeds", () => {
    expect(
      bindingOf({ verdict: verdictWith({ binding: wellFormed }) }),
    ).toEqual({ outcome: "ok", value: wellFormed });
  });

  test("a missing diffDigest is rejected before any git runs", () => {
    const { diffDigest: _dropped, ...withoutDigest } = wellFormed;
    expect(
      bindingOf({ verdict: verdictWith({ binding: withoutDigest }) }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "landed",
        missing: ["diffDigest"],
      },
    });
  });

  test("every missing field is named, not just the first", () => {
    const verdict = verdictWith({
      binding: { mode: "landed", reviewedHeadSha: REVIEWED_HEAD },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "landed",
        missing: ["pullRequestNumber", "mergeCommitSha", "diffDigest"],
      },
    });
  });

  test("a string pullRequestNumber is ill-typed, not coerced", () => {
    const verdict = verdictWith({
      binding: { ...wellFormed, pullRequestNumber: "561" },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: {
        kind: "binding-fields-incomplete",
        mode: "landed",
        missing: ["pullRequestNumber"],
      },
    });
  });
});

describe("bindingOf refuses anything outside the closed union", () => {
  test("a third mode is rejected by name rather than falling through", () => {
    const verdict = verdictWith({
      headSha: HEAD_SHA,
      binding: { mode: "asserted", headSha: HEAD_SHA },
    });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: { kind: "binding-mode-unknown", mode: "asserted" },
    });
  });

  test("a non-string mode renders as absent", () => {
    const verdict = verdictWith({ binding: { mode: 7 } });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: { kind: "binding-mode-unknown", mode: "absent" },
    });
  });

  test("a binding that is not an object is rejected, never read as live", () => {
    const verdict = verdictWith({ headSha: HEAD_SHA, binding: "live" });
    expect(bindingOf({ verdict })).toEqual({
      outcome: "failed",
      error: { kind: "binding-mode-unknown", mode: "absent" },
    });
  });
});

describe("recordsOnlyDriftVerdictOf tolerates only the own record dir", () => {
  test("every path inside the allowed prefix is tolerated", () => {
    expect(
      recordsOnlyDriftVerdictOf({
        changedPaths: [
          `${RECORD_PREFIX}aidlc-state.md`,
          `${RECORD_PREFIX}construction/rin-gate-4-implement/memory.md`,
        ],
        allowedPrefix: RECORD_PREFIX,
      }),
    ).toEqual({ tolerated: true });
  });

  test("one source file outside the prefix reclassifies the whole diff", () => {
    expect(
      recordsOnlyDriftVerdictOf({
        changedPaths: [
          `${RECORD_PREFIX}aidlc-state.md`,
          "packages/kernel/src/thing.ts",
        ],
        allowedPrefix: RECORD_PREFIX,
      }),
    ).toEqual({
      tolerated: false,
      offendingPath: "packages/kernel/src/thing.ts",
    });
  });

  test("another intent's record dir is outside the prefix", () => {
    const other = "aidlc/spaces/default/intents/260801-other-intent/notes.md";
    expect(
      recordsOnlyDriftVerdictOf({
        changedPaths: [other],
        allowedPrefix: RECORD_PREFIX,
      }),
    ).toEqual({ tolerated: false, offendingPath: other });
  });

  test("a sibling sharing a name prefix cannot slip past the trailing slash", () => {
    const sibling =
      "aidlc/spaces/default/intents/260816-verdict-landed-binding-2/state.md";
    expect(
      recordsOnlyDriftVerdictOf({
        changedPaths: [sibling],
        allowedPrefix: RECORD_PREFIX,
      }),
    ).toEqual({ tolerated: false, offendingPath: sibling });
  });

  test("an empty changed-path set is never vacuously tolerated", () => {
    const drift = recordsOnlyDriftVerdictOf({
      changedPaths: [],
      allowedPrefix: RECORD_PREFIX,
    });
    expect(drift.tolerated).toBe(false);
  });

  test("the first offending path is the one named", () => {
    expect(
      recordsOnlyDriftVerdictOf({
        changedPaths: ["docs/a.md", "scripts/b.ts"],
        allowedPrefix: RECORD_PREFIX,
      }),
    ).toEqual({ tolerated: false, offendingPath: "docs/a.md" });
  });
});
