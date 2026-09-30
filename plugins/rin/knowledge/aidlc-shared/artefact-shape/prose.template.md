# <Artefact title>

<One sentence: what this document decides or assesses, and for which record.>

Derivation history — the instruments that were wrong and the claims withdrawn — is in this stage's `memory.md`. Measured claims are keyed rows in `facts.md`. **This document reasons over those facts and states no figure of its own.**

## 1. <Conclusion, stated as the heading>

<Reasoning that reaches the conclusion, referencing fact keys. Every number appears as a key.>

Example of the shape:

> The prior schedule inverted this: intake carried the largest share of the queue (Q-2) on the shortest timebox in the set, while the review sweep held its box against the smallest pile (Q-3). Throughput against the open-PR count (Q-7, Q-8) shows review was not the constraint.

Note what that sentence does **not** contain: no figure. A reader who wants the number follows the key; a reviewer refuting the number edits one row.

**Qualifier that limits this conclusion:** <the honest caveat, also keyed>.

## 2. <Next conclusion>

<As above.>

**Recommendation:** <what to do>.

**Falsifiable test:** <what would show this wrong, and what it costs to run>. A recommendation with no test attached is an opinion.

## Limits

- <What these facts cannot establish, stated plainly rather than implied.>
- <Any fact whose status is `unmeasured`, named here so a reader does not mistake absence for zero.>

## Writing rules

Four rules, all mechanically checkable except the last:

1. **Every figure is a fact key.** Dates, record slugs, section numbers and gate numbers are exempt. Everything else lives in `facts.md`.
2. **Every key you reference must resolve**, and every fact you define must be referenced at least once. An orphan fact is either missing from the argument or should not be a fact.
3. **A correction replaces**, in the row. It never appends beside the claim, and the artefact never narrates its own change history — that is `memory.md`.
4. **Prose carries the reasoning, not the record.** If a paragraph re-establishes context that a key already carries, cut it: re-establishing context is how restatement gets in.

Rules 1-2 are enforced by `pnpm run artefact-shape`. Rules 3-4 are judgement, and stay with the review board.
