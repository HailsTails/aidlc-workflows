import { describe, expect, test } from "vitest";
import { extractLensVerdict } from "./rin-gates-lens-verdict.ts";

const WELL_FORMED = `## Review

Looked at the diff.

<!--rin-gates-lens:v1
{ "gate": "rin-gate-2-plan-review", "verdict": "READY", "findings": [] }
rin-gates-lens:v1-->`;

describe("the structured block stays the precision channel", () => {
  test("reads verdict, gate and findings from a well-formed block", () => {
    const extracted = extractLensVerdict(WELL_FORMED);
    expect(extracted).toEqual({
      gate: "rin-gate-2-plan-review",
      verdict: "READY",
      findings: [],
      channel: "structured-block",
    });
  });

  test("carries the declared findings list", () => {
    const extracted = extractLensVerdict(
      `<!--rin-gates-lens:v1
{ "verdict": "NOT-READY", "findings": ["a.ts:1 | code | CD-6 | bad name"] }
rin-gates-lens:v1-->`,
    );
    expect(extracted?.findings).toEqual(["a.ts:1 | code | CD-6 | bad name"]);
  });
});

// The three malformations measured on 2026-08-07, each from a real lens run.
describe("the observed malformations are read, not discarded", () => {
  test("single-line block with the closing token absent", () => {
    const extracted = extractLensVerdict(
      `<!-- rin-gates-lens:v1 { "gate": "rin-gate-0-reconcile", "verdict": "READY", "findings": [] } -->`,
    );
    expect(extracted?.verdict).toBe("READY");
    expect(extracted?.gate).toBe("rin-gate-0-reconcile");
  });

  test("single-line block nested inside a code fence", () => {
    const extracted = extractLensVerdict(
      '```\n<!-- rin-gates-lens:v1 { "verdict": "READY", "findings": [] } -->\n```',
    );
    expect(extracted?.verdict).toBe("READY");
  });

  test("bare fenced JSON with no HTML comment at all", () => {
    const extracted = extractLensVerdict(
      '```json\n{ "gate": "rin-gate-1-framing", "verdict": "NOT-READY", "findings": [] }\n```',
    );
    expect(extracted?.verdict).toBe("NOT-READY");
    expect(extracted?.gate).toBe("rin-gate-1-framing");
  });
});

describe("the native ## Verdict section is the reliable fallback", () => {
  test("reads a READY verdict section", () => {
    const extracted = extractLensVerdict(
      "## Review\n\nAll clean.\n\n## Verdict\n\nREADY — every orchestrator is pure.",
    );
    expect(extracted).toEqual({
      gate: null,
      verdict: "READY",
      findings: [],
      channel: "verdict-section",
    });
  });

  test("reads a NOT-READY verdict section and harvests cited findings", () => {
    const extracted = extractLensVerdict(
      [
        "## Verdict",
        "",
        "NOT-READY",
        "",
        "- src/a.ts:12 | const x = y as Foo | CD-2 | cast defeats the type",
        "- src/b.ts:3 | function f(a, b) | CD-45 | positional arguments",
        "",
        "Fix these and re-run.",
      ].join("\n"),
    );
    expect(extracted?.verdict).toBe("NOT-READY");
    expect(extracted?.findings).toEqual([
      "src/a.ts:12 | const x = y as Foo | CD-2 | cast defeats the type",
      "src/b.ts:3 | function f(a, b) | CD-45 | positional arguments",
    ]);
  });

  test("reads the heading at any level and any letter case", () => {
    expect(extractLensVerdict("#### verdict\n\nREADY")?.verdict).toBe("READY");
  });

  // A full-shaped lens message: prose, subheadings, then the verdict section
  // worded as the agent definitions themselves word it. This is the shape the
  // 399 discarded captures actually had.
  test("reads a realistically-shaped lens message end to end", () => {
    const extracted = extractLensVerdict(
      [
        "## Review",
        "",
        "I walked every added function in the diff.",
        "",
        "### Orchestrator purity",
        "",
        "Checked. No body conflates abstractions.",
        "",
        "## Verdict",
        "",
        "READY — every orchestrator is pure, every success/failure branch aborts",
        "early, and no function mutates a parameter's fields.",
      ].join("\n"),
    );
    expect(extracted?.verdict).toBe("READY");
    expect(extracted?.channel).toBe("verdict-section");
  });

  // The same shape with a subheading BEFORE the verdict section: the region must
  // start at the verdict heading, not at an earlier one.
  test("a subheading before the verdict section does not shadow it", () => {
    const extracted = extractLensVerdict(
      "## Review\n\n### Findings\n\nNone blocking.\n\n## Verdict\n\nNOT-READY",
    );
    expect(extracted?.verdict).toBe("NOT-READY");
  });
});

// The two shapes that discarded 32 real lens verdicts across four gates between
// 2026-08-07 and 2026-08-09 (task 019fe4af). Both were produced by lenses that
// ran for real, read source, and returned cited findings. The heading-anchored
// reader consumed the token into the heading line, or found no heading at all.
describe("the verdict token is read wherever it unambiguously sits", () => {
  test("token ON the heading line — `## Verdict: NOT-READY`", () => {
    const extracted = extractLensVerdict(
      "## Review\n\nRead the bundle.\n\n## Verdict: NOT-READY\n\n## Findings\n\nSee above.",
    );
    expect(extracted?.verdict).toBe("NOT-READY");
  });

  test("token on the heading line, READY, with the body empty", () => {
    const extracted = extractLensVerdict(
      "## Verdict: READY\n\n## Notes\n\nNothing further.",
    );
    expect(extracted?.verdict).toBe("READY");
  });

  test("bold inline verdict with no heading at all — `**VERDICT: NOT-READY**`", () => {
    const extracted = extractLensVerdict(
      "## Review\n\nI walked every changed file.\n\n**VERDICT: NOT-READY**\n\n- src/a.ts:4 | const x = y as Foo | CD-1 | cast defeats the type",
    );
    expect(extracted?.verdict).toBe("NOT-READY");
  });

  test("bold inline READY verdict with no heading", () => {
    expect(
      extractLensVerdict("## Review\n\nClean.\n\n**Verdict: READY**")?.verdict,
    ).toBe("READY");
  });

  test("findings are still harvested when the token sits on the heading line", () => {
    const extracted = extractLensVerdict(
      [
        "## Verdict: NOT-READY",
        "",
        "- src/a.ts:12 | const x = y as Foo | CD-2 | cast defeats the type",
        "- src/b.ts:3 | function f(a, b) | CD-45 | positional arguments",
      ].join("\n"),
    );
    expect(extracted?.findings).toEqual([
      "src/a.ts:12 | const x = y as Foo | CD-2 | cast defeats the type",
      "src/b.ts:3 | function f(a, b) | CD-45 | positional arguments",
    ]);
  });

  // The widened reader must not become a keyword sniffer. An inline verdict is
  // only a verdict where the line DECLARES itself one; a sentence that merely
  // contains the word stays out of scope, exactly as before.
  test("prose merely containing READY is still not a verdict", () => {
    expect(
      extractLensVerdict(
        "## Review\n\nThe implementation looks READY to me overall.",
      ),
    ).toBeNull();
  });

  test("an inline verdict line naming both tokens resolves to NOT-READY", () => {
    expect(
      extractLensVerdict("**Verdict: READY / NOT-READY** — I judge NOT-READY.")
        ?.verdict,
    ).toBe("NOT-READY");
  });

  test("a heading-line READY does not outrank a NOT-READY in its own body", () => {
    expect(
      extractLensVerdict(
        "## Verdict: READY\n\nOn reflection NOT-READY — see findings.",
      )?.verdict,
    ).toBe("NOT-READY");
  });
});

// The load-bearing safety property. A permissive reader is only safe because
// every ambiguity resolves AWAY from READY: being wrong costs a re-review, and
// can never manufacture an approval.
describe("extraction is fail-safe toward NOT-READY", () => {
  test("NOT-READY is not misread as READY despite READY being its substring", () => {
    expect(extractLensVerdict("## Verdict\n\nNOT-READY")?.verdict).toBe(
      "NOT-READY",
    );
  });

  test.each([
    ["hyphenated", "NOT-READY"],
    ["spaced", "NOT READY"],
    ["underscored", "NOT_READY"],
    ["lowercased", "not-ready"],
  ])("%s spelling resolves to NOT-READY", (_label, spelling) => {
    expect(extractLensVerdict(`## Verdict\n\n${spelling}`)?.verdict).toBe(
      "NOT-READY",
    );
  });

  test("a section naming BOTH tokens resolves to NOT-READY", () => {
    expect(
      extractLensVerdict(
        "## Verdict\n\nREADY / NOT-READY with cited findings — I judge NOT-READY.",
      )?.verdict,
    ).toBe("NOT-READY");
  });

  test("a structured NOT-READY block is never upgraded by later READY prose", () => {
    const extracted = extractLensVerdict(
      `<!--rin-gates-lens:v1
{ "verdict": "NOT-READY", "findings": [] }
rin-gates-lens:v1-->

## Verdict

READY`,
    );
    expect(extracted?.verdict).toBe("NOT-READY");
  });

  test("READY in prose outside any verdict section is not a verdict", () => {
    expect(
      extractLensVerdict("## Review\n\nThe code looks READY to me overall."),
    ).toBeNull();
  });

  test("READY after the verdict section's next heading is out of region", () => {
    expect(extractLensVerdict("## Verdict\n\n## Notes\n\nREADY")).toBeNull();
  });

  test.each([
    ["undefined message", undefined],
    ["empty message", ""],
    ["whitespace-only message", "   \n\t "],
    ["no verdict anywhere", "## Review\n\nI read the diff and formed no view."],
  ])("returns null for %s", (_label, message) => {
    expect(extractLensVerdict(message)).toBeNull();
  });

  test("an unparseable block body falls through rather than passing", () => {
    expect(
      extractLensVerdict(
        "<!--rin-gates-lens:v1\n{ not json\nrin-gates-lens:v1-->",
      ),
    ).toBeNull();
  });

  test("an unknown verdict token is refused, not coerced", () => {
    expect(
      extractLensVerdict(
        '<!--rin-gates-lens:v1\n{ "verdict": "MAYBE" }\nrin-gates-lens:v1-->',
      ),
    ).toBeNull();
  });
});
