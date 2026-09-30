// Which cited findings still BLOCK a verdict (task 019f6d3e).
//
// Step 5 of the decorrelated-review protocol (decorrelated-review.md:99-101) says
// READY requires every producing lens READY *or its VIOLATIONs resolved at a
// principled bar*. Only the first clause was ever enforced, so a lens (or a
// caller) could assert READY over its own live cited violations and nothing could
// refuse it. This predicate is that second clause made checkable.
//
// It lives beside `rin-gate-namespace.ts` — the same shape of small shared module
// projected across the .claude/ and plugins/rin/ trees — because BOTH doors to a
// gate verdict must agree on what READY means: the SubagentStop review-scribe
// (which harvests findings from each lens's own verdict section) and this
// directory's CLI emitter (which takes them from the caller). A predicate
// reachable from only one tree would let the two doors drift apart, which is the
// gap itself in a new form.
//
// THE EVIDENCE REQUIREMENT, and why a bare prefix is not a disposition. The
// ratified closed set is `fixed@<sha>` / `push-back(<ground>)` / `defer(ack:<ref>)`
// (rin-gate-5-review-cycle.md:110-111) — the trailing reference is the SUBSTANCE
// of each disposition, not decoration: a defer without an ack is by definition
// unresolved. An earlier draft of this predicate matched the bare words, which
// re-opened under a more credible-sounding token the exact escape hatch this task
// exists to close: a live violation prefixed `DEFERRED:` would have cleared the
// gate that `non-blocking note` no longer clears. Each prefix therefore demands
// its own evidence shape below.
//
// Note the direction of THIS defect class, which is the opposite of the
// extractor's. A finding wrongly read as LIVE costs a re-review. A finding wrongly
// read as DISPOSED removes a refusal that should have fired — the central failure
// of a refusal-only guard. So the bar is set to over-block: an unrecognised
// disposition shape is LIVE.

// `fixed` / `resolved` carry the commit that did it: `fixed@<sha>` (also accepted
// as `fixed <sha>` / `fixed: <sha>`), where <sha> is a git-ish hex of 7+ chars.
const FIXED_WITH_SHA =
  /^(?:FIXED|RESOLVED)\b[\s:@]*(?:@|\bin\b)?\s*[0-9a-f]{7,40}\b/i;

// `push-back` carries the ground it stands on, PARENTHESISED as the ratified
// `push-back(<ground>)` shape requires. The parentheses are load-bearing and not
// cosmetic: they delimit the author's own justification from the finding text it
// precedes. A shape that merely looked for a CD-id or a `file:line` ANYWHERE
// after the prefix would be satisfied by the cited finding itself — every finding
// carries a coordinate and a CD-id by construction — so `push-back: <finding>`
// would self-justify. The ground must be a span the author wrote, not the row.
const PUSH_BACK_WITH_GROUND = /^PUSH-?BACK\s*\([^)]*\S[^)]*\)/i;

// `defer` carries the acknowledgement that authorises it — a defer with no ack is
// unresolved. Same delimiting reason as above: the ack sits inside the parens.
const DEFER_WITH_ACK = /^DEFER(?:RED)?\s*\([^)]*\S[^)]*\)/i;

// `withdrawn` is the reviewer retracting its OWN finding — a fourth disposition
// beyond the ratified three, and the only self-serve one. It therefore needs the
// author-delimited span MOST, not least: the other three carry an externally
// checkable referent (a sha, a ground, an ack), so a fabricated one is at least a
// checkable lie. A withdrawal has no external referent by design, which makes the
// delimiter the only check there can be. An earlier draft required merely one
// non-whitespace token after the prefix — satisfied by the FINDING'S OWN first
// token, so `WITHDRAWN: <finding>` self-disposed. That is the same
// self-justification defect closed above, surviving on the one shape least able
// to afford it.
const WITHDRAWN_WITH_REASON = /^WITHDRAWN\s*\([^)]*\S[^)]*\)/i;

const DISPOSITION_SHAPES: readonly RegExp[] = [
  FIXED_WITH_SHA,
  PUSH_BACK_WITH_GROUND,
  DEFER_WITH_ACK,
  WITHDRAWN_WITH_REASON,
];

// A leading list bullet is the ordinary way a lens writes its finding rows, so it
// is stripped before the shapes are tested — it carries no meaning either way.
const LEADING_BULLET = /^[-*]\s*/;

const isDisposed = (finding: string): boolean => {
  const withoutBullet = finding.trim().replace(LEADING_BULLET, "");
  return DISPOSITION_SHAPES.some((shape) => shape.test(withoutBullet));
};

// Consulted ONLY to refuse a READY, never to grant one. Combined with the
// over-blocking bar above, an unrecognised or evidence-free disposition keeps the
// finding live rather than silently clearing it.
export const blockingFindingsIn = (
  findings: readonly string[],
): readonly string[] => findings.filter((finding) => !isDisposed(finding));
