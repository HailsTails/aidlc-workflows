import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { resolveReviewRoster, rosterFrom } from "./shared-review-roster.ts";

const GATE = "rin-gate-3-interface-lock";
const SOURCE_LABEL = "review-rosters.json";
// The config's own annotation convention — a `$`-prefixed key carries prose, not
// a lens list. Held as a value because it IS the wire format, not an identifier.
const ANNOTATION_KEY = "$comment";

const configHolding = (contents: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "rin-roster-config-"));
  const path = join(directory, "review-rosters.json");
  writeFileSync(path, contents, "utf-8");
  return path;
};

const missingConfigPath = (): string =>
  join(
    mkdtempSync(join(tmpdir(), "rin-roster-absent-")),
    "does-not-exist.json",
  );

// The fall-through rules are a PURE decision over an already-read config, so
// they are asserted directly against `rosterFrom` — no filesystem, no temp dir.
// Reaching them through `resolveReviewRoster` would assert this unit's
// responsibility through a composing wrapper, which is the delegation shape the
// discipline forbids and the reason the read/decide split exists.
describe("rosterFrom — which floor a readable config yields", () => {
  test("a gate's own byGate entry wins, and reports byGate as its source", () => {
    expect(
      rosterFrom({
        config: {
          defaultRoster: ["rin-naming-reviewer-agent"],
          byGate: { [GATE]: ["aidlc-architecture-reviewer-agent"] },
        },
        gate: GATE,
        sourceLabel: SOURCE_LABEL,
      }),
    ).toEqual({
      kind: "resolved",
      roster: ["aidlc-architecture-reviewer-agent"],
      source: "byGate",
    });
  });

  // The defect this Slice exists to close: an empty entry once read as "no
  // floor for this gate", so one character disabled the floor for any gate.
  test("an EMPTY byGate entry falls through to defaultRoster", () => {
    expect(
      rosterFrom({
        config: {
          defaultRoster: ["rin-naming-reviewer-agent"],
          byGate: { [GATE]: [] },
        },
        gate: GATE,
        sourceLabel: SOURCE_LABEL,
      }),
    ).toEqual({
      kind: "resolved",
      roster: ["rin-naming-reviewer-agent"],
      source: "defaultRoster",
    });
  });

  test("a gate absent from byGate falls through to defaultRoster", () => {
    expect(
      rosterFrom({
        config: {
          defaultRoster: ["rin-naming-reviewer-agent"],
          byGate: {
            "rin-gate-0-reconcile": ["aidlc-architecture-reviewer-agent"],
          },
        },
        gate: GATE,
        sourceLabel: SOURCE_LABEL,
      }),
    ).toEqual({
      kind: "resolved",
      roster: ["rin-naming-reviewer-agent"],
      source: "defaultRoster",
    });
  });

  test("a config declaring no lenses anywhere is unreadable, never an empty floor", () => {
    expect(
      rosterFrom({
        config: { defaultRoster: [], byGate: {} },
        gate: GATE,
        sourceLabel: SOURCE_LABEL,
      }),
    ).toEqual({
      kind: "unreadable",
      reason: `${SOURCE_LABEL} declares no lenses for '${GATE}' and no defaultRoster`,
    });
  });

  test("an empty byGate entry with an empty default is unreadable, not covered", () => {
    expect(
      rosterFrom({
        config: { defaultRoster: [], byGate: { [GATE]: [] } },
        gate: GATE,
        sourceLabel: SOURCE_LABEL,
      }),
    ).toEqual({
      kind: "unreadable",
      reason: `${SOURCE_LABEL} declares no lenses for '${GATE}' and no defaultRoster`,
    });
  });
});

// These arms exist BECAUSE of the read, so they are asserted through the
// reading entry point. A fake filesystem would prove nothing a real temp file
// does not, and the bytes on disk are the assertion's subject.
describe("resolveReviewRoster — a roster that cannot be read is never one that is empty", () => {
  test("an absent config is unreadable, naming the path", () => {
    const path = missingConfigPath();
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "unreadable",
      reason: `cannot read ${path}`,
    });
  });

  test("an unparseable config is unreadable, not an empty floor", () => {
    const path = configHolding("{ this is not json");
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "unreadable",
      reason: `${path} is not parseable JSON`,
    });
  });

  // An array IS an object, so a `typeof parsed !== "object"` guard alone lets
  // this reach the success path. That is the route the Array.isArray check
  // exists for, and it is the one a reader is most likely to think is covered.
  test("valid JSON that is an array is unreadable, not an empty floor", () => {
    const path = configHolding(JSON.stringify(["not", "an", "object"]));
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "unreadable",
      reason: `${path} does not contain a JSON object`,
    });
  });

  test("a $-prefixed byGate key is an annotation, never a gate", () => {
    const path = configHolding(
      JSON.stringify({
        defaultRoster: ["rin-naming-reviewer-agent"],
        byGate: {
          [ANNOTATION_KEY]: "why this gate's floor is what it is",
          [GATE]: ["aidlc-architecture-reviewer-agent"],
        },
      }),
    );
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "resolved",
      roster: ["aidlc-architecture-reviewer-agent"],
      source: "byGate",
    });
  });

  test("non-string roster entries are dropped rather than carried", () => {
    const path = configHolding(
      JSON.stringify({
        defaultRoster: ["rin-naming-reviewer-agent", 7, null],
        byGate: {},
      }),
    );
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "resolved",
      roster: ["rin-naming-reviewer-agent"],
      source: "defaultRoster",
    });
  });

  // The one COMPOSITION fact neither unit can prove alone: the read's path is
  // threaded through as the decision's sourceLabel, so a no-floor-anywhere
  // refusal names the real config file rather than a placeholder. The pure
  // tests pass a literal label and cannot see this hop.
  test("a no-floor-anywhere refusal names the config path it actually read", () => {
    const path = configHolding(
      JSON.stringify({ defaultRoster: [], byGate: {} }),
    );
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "unreadable",
      reason: `${path} declares no lenses for '${GATE}' and no defaultRoster`,
    });
  });

  test("the reading entry point carries a readable config through to its floor", () => {
    const path = configHolding(
      JSON.stringify({
        defaultRoster: ["rin-naming-reviewer-agent"],
        byGate: { [GATE]: ["aidlc-architecture-reviewer-agent"] },
      }),
    );
    expect(resolveReviewRoster({ configPath: path, gate: GATE })).toEqual({
      kind: "resolved",
      roster: ["aidlc-architecture-reviewer-agent"],
      source: "byGate",
    });
  });
});
