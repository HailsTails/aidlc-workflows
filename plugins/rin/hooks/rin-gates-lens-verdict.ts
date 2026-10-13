// Verdict extraction for the rin-gates review-scribe — the TOOL owns the verdict.
//
// The scribe derives the verdict from native model output rather than requiring
// an exact HTML comment pair wrapping JSON. A free-text delimiter contract can
// fail through absent closing tokens, fenced blocks, or missing comment markers.
// Repeating a template in reviewer instructions does not enforce its output
// serialization. Keep that deterministic boundary in the extractor.
//
// WHY NOT "GIVE THE LENS A CLI TO CALL". Every lens ships `tools: Read, Grep,
// Glob` + `disallowedTools: Task`, and that grant IS the reviewer-not-author
// guarantee (decorrelated-review.md: a lens "physically cannot mutate what it
// judges"). Granting Bash so a lens could invoke a recorder would hand each lens
// the ability to write its own review-verdict.json — collapsing the hole the
// verdict guard exists to plug. Forgery-resistance is not tradeable for
// serialisation-reliability.
//
// So the TOOL owns extraction instead, exactly as `aidlc-swarm.ts` owns the
// convergence verdict: the worker's claim is an input to VERIFY, never a fact to
// accept. This module reads the lens's NATIVE contract — the `## Verdict` section
// every reviewer agent already declares — and the structured block becomes an
// optional precision channel rather than the sole gate.
//
// THE SAFETY INVARIANT, and why a permissive reader is still safe: extraction is
// FAIL-SAFE TOWARD NOT-READY. READY is returned only on an unambiguous, positively
// matched READY with no NOT-READY anywhere in the verdict region. Anything else —
// absent, ambiguous, both tokens present, unparseable — is NOT-READY or null, both
// of which BLOCK the gate. A reader that is wrong can only ever cost a re-review;
// it can never manufacture an approval. That asymmetry is what makes widening the
// accepted shapes safe rather than a weakening of the gate.

export type LensVerdict = {
  readonly gate: string | null;
  readonly verdict: "READY" | "NOT-READY";
  readonly findings: readonly string[];
  readonly channel: "structured-block" | "verdict-section";
};

const CLOSED_VERDICTS: readonly string[] = ["READY", "NOT-READY"];

// NOT-READY must be tested FIRST and matched anywhere it appears: `READY` is a
// substring of `NOT-READY`, so any reader that looks for READY first misreads
// every NOT-READY as READY — the one failure that could manufacture an approval.
const NOT_READY_TOKEN = /\bNOT[\s_-]?READY\b/i;
const READY_TOKEN = /\bREADY\b/i;

// The structured block, kept as the precision channel for a lens that emits it.
// Delimiters are matched leniently — optional whitespace after the opening token,
// an optional closing token, and an optional surrounding code fence — because
// supported delimiter variations must not block a well-formed JSON payload.
const STRUCTURED_BLOCK =
  /<!--\s*rin-gates-lens:v1\s*([\s\S]*?)(?:\s*rin-gates-lens:v1\s*)?-->/;

// A fenced block whose body is the lens JSON, with no HTML comment at all — one of
// the supported fenced input shapes.
const FENCED_LENS_JSON = /```(?:json)?\s*(\{[\s\S]*?"verdict"[\s\S]*?\})\s*```/;

const parseJsonPayload = (payload: string): LensVerdict | null => {
  try {
    const parsed: unknown = JSON.parse(payload.trim());
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as {
      gate?: unknown;
      verdict?: unknown;
      findings?: unknown;
    };
    if (typeof record.verdict !== "string") return null;
    const normalised = record.verdict.trim().toUpperCase();
    if (!CLOSED_VERDICTS.includes(normalised)) return null;
    return {
      gate: typeof record.gate === "string" ? record.gate : null,
      verdict: normalised === "READY" ? "READY" : "NOT-READY",
      findings: Array.isArray(record.findings)
        ? record.findings.filter(
            (finding): finding is string => typeof finding === "string",
          )
        : [],
      channel: "structured-block",
    };
  } catch {
    return null;
  }
};

const fromStructuredBlock = (message: string): LensVerdict | null => {
  const commentMatch = message.match(STRUCTURED_BLOCK);
  const fromComment =
    commentMatch === null ? null : parseJsonPayload(commentMatch[1]);
  if (fromComment !== null) return fromComment;
  const fencedMatch = message.match(FENCED_LENS_JSON);
  return fencedMatch === null ? null : parseJsonPayload(fencedMatch[1]);
};

// The lens's native contract: a line that DECLARES itself the verdict. Accepted
// shapes place the token below a heading, on the heading, or in a bold inline
// declaration:
//
//   ## Verdict            <- heading, token in the body below
//   ## Verdict: NOT-READY <- heading, token ON the heading line
//   **VERDICT: READY**    <- bold inline declaration, no heading at all
//
// A declaration line is required — the reader is not a keyword sniffer. Prose
// that merely contains the word READY is not a verdict and still returns null.
const VERDICT_DECLARATION =
  /^[ \t]*(?:#{1,6}[ \t]*|\*\*[ \t]*)verdict\b[^\n]*$/im;

// Bound the region so a `READY` mentioned in later prose cannot be read as the
// verdict. The region ends at the next heading of any level.
const NEXT_HEADING = /^[ \t]*#{1,6}[ \t]+\S/m;

// The region INCLUDES the declaration line itself. Slicing from its end would
// discard the only token in `## Verdict: NOT-READY`, leaving an empty region
// or another heading. Including the line cannot manufacture an approval:
// NOT-READY is tested first and matched anywhere in the region, so a declaration
// naming both tokens resolves to NOT-READY.
const verdictRegionOf = (message: string): string | null => {
  const declaration = message.match(VERDICT_DECLARATION);
  if (declaration?.index === undefined) return null;
  const fromDeclaration = message.slice(declaration.index);
  const afterDeclaration = fromDeclaration.slice(declaration[0].length);
  const next = afterDeclaration.match(NEXT_HEADING);
  return next?.index === undefined
    ? fromDeclaration
    : fromDeclaration.slice(0, declaration[0].length + next.index);
};

// A findings line is a cited violation in the lens's declared citation shape
// (`file:line | quoted code | <CD-id> | defect-named`). Only pipe-cited lines are
// harvested — prose sentences in the section are commentary, not findings.
const FINDING_LINE = /^[ \t]*(?:[-*]\s*)?(\S[^\n]*\|[^\n]*\|[^\n]*)$/gm;

const findingsIn = (region: string): readonly string[] =>
  [...region.matchAll(FINDING_LINE)].map((match) => match[1].trim());

// The findings a lens cited and did NOT dispose — re-exported from the single
// definition beside the CLI emitter, so the scribe door and the emitter door
// cannot drift about what READY means.
export { blockingFindingsIn } from "../tools/rin-gates/rin-gates-finding-disposition.ts";

const fromVerdictSection = (message: string): LensVerdict | null => {
  const region = verdictRegionOf(message);
  if (region === null) return null;
  // NOT-READY first, and anywhere in the region: a section that names both tokens
  // is a lens hedging or citing the rubric, which must never resolve to READY.
  if (NOT_READY_TOKEN.test(region)) {
    return {
      gate: null,
      verdict: "NOT-READY",
      findings: findingsIn(region),
      channel: "verdict-section",
    };
  }
  if (!READY_TOKEN.test(region)) return null;
  return {
    gate: null,
    verdict: "READY",
    findings: findingsIn(region),
    channel: "verdict-section",
  };
};

// Extraction order is precision-first: an explicitly structured block carries a
// declared `gate` (which the scribe cross-checks) and author-chosen findings, so
// it wins when present. The native section is the fallback that makes the common
// case work at all.
export const extractLensVerdict = (
  message: string | undefined,
): LensVerdict | null => {
  if (message === undefined || message.trim() === "") return null;
  return fromStructuredBlock(message) ?? fromVerdictSection(message);
};
