---
lens: [defended-on-intent]
fuelled-by: every other lens's findings and the codebase constitution's "reading rules" (this lens checks letter-vs-intent across the bundle, not numbered rules)
---

# Defended-on-intent lens

A reusable audit method, not a ruleset. Unlike the other lenses, this one owns
**no numbered rules of its own** — it loads no `lens:`-tagged code-discipline
file. Its denominator is the *bundle*: the PASS claims every other lens (and the
bundle's constitution-check) already asserted, re-tested against the *intent* of
the clause each one cited. This file describes only *how* the lens reads those
claims — the concept, the inspection procedure, the letter-vs-intent test, and
the output shape. It names no specific rule numbers, file paths, type names, or
library names; those live in the constitution and the claims under review, and
differ per codebase.

## Concept

This lens defends **intent over letter**: a PASS is only a PASS when the
artefact satisfies both the literal text of the cited rule *and* the principle
that rule exists to encode. The failure shape it hunts is
**letter-pass-intent-fail** — the rule's letter names mechanism X, the artefact
uses mechanism Y, so the author concludes "the rule does not apply", while
mechanism Y subverts the very principle the rule operationalises. The letter
test and the intent test have *different denominators*; an author who runs only
the letter test passes a class of artefacts the principle forbids.

No script catches this gap — if one could, the gap would not have reached a
review bundle in the first place. The structural anti-laziness mechanism is the
mechanical application of the three-step test below to *every* PASS claim in the
bundle. Skipping a step is not a shortcut; skipping a step IS the failure mode
this lens exists to detect in others, so the lens cannot tolerate skipping it in
itself.

Across codebases the concept recurs under different names (spirit-vs-letter,
substance-over-form, "the rule means what it's for, not what it literally
enumerates"). The mechanism is always the same: derive the rule's intent from
the principle it sits under, then re-test the defended artefact against that
intent rather than against the enumerated letter.

## Loading the ruleset

This lens loads **no `lens:`-tagged rules**. Instead:

1. The **denominator** is fixed by the bundle: the set of PASS claims the other
   lenses' collated reports make, plus the PASS rows the bundle's
   constitution-check already asserts. The lens neither discovers new clauses
   nor enumerates the constitution — both are out of scope. VIOLATION rows are
   another lane; this lens reads PASS claims only.
2. For each PASS, the constitution at the resolved path is consulted **solely to
   look up the literal text of the cited clause** — never to find new clauses to
   test. Resolve the code-discipline directory the dispatching workflow names
   (the convention is `code-discipline/` beside the constitution); each PASS
   cites a rule by its declared id, and that rule's file is where the literal
   text and its governing principle live.
3. If the bundle carries zero PASS claims with cited artefacts, produce an empty
   gap set — do not invent claims to test.

## Inspection procedure

For each PASS claim in the bundle, apply three steps mechanically. Skipping a
step is the laziness this lens detects in others.

### Step 1 — Cite the clause text

Open the constitution at the resolved path. Locate the cited rule. Quote ≤2
lines of its **literal text** — no paraphrase, no "in essence", no summary. The
literal text is the letter: the test the PASS author already ran. Quoting it
forces an honest comparison at step 3.

If the cited rule does not exist at the resolved path, the PASS is malformed:
surface it as a separate-shape finding ("PASS cites a clause that does not exist
at the resolved path") and continue to the next claim. Do not invent a clause to
test against. If the PASS cites no artefact text / file:line / interface
fragment, step 3 has nothing to run against: surface it as **excluded** with
reason "no artefact citation — PASS unfalsifiable as written", and do not invent
an artefact.

### Step 2 — Write the rule's intent in one sentence

Your own synthesis. No citation. One sentence. No hedging. Derive the intent
from **the principle the clause sits under**, not from the clause's letter. A
constitution clusters rules under principles, each of which carries a standing
charge the rules under it operationalise. A rule's intent is *that principle's
standing charge applied to the specific surface the rule names*.

The discipline:

- **One sentence.** If it needs two, you have not yet boiled it down.
- **No citation.** If you write "per Principle V…" you are paraphrasing; rewrite
  it as a positive claim.
- **No hedging.** No "roughly", "essentially", "in spirit". The intent sentence
  must be specific enough that step 3 can *fail*.

Two opposite traps bound the intent sentence:

- **Tautological intent.** If your sentence rewrites cleanly back to the letter,
  the test is a re-run of the letter test and will catch nothing. The intent
  sentence is correct only when it and the letter have *different denominators*
  — i.e. there exist artefacts that pass the letter and fail the intent.
- **Manufactured intent.** If your sentence reaches *past* the principle's
  standing charge to manufacture a test the author could not reasonably have
  intended, you have become a generic reviewer inventing findings. The intent
  must be *derivable from the principle*, never invented to manufacture a gap.
  When in doubt, discard the intent sentence and exclude the PASS.

### Step 3 — Re-test the artefact against the intent

Read the same artefact text the PASS author defended — the file:line, the
interface fragment, the test code, whatever the PASS pointed at. Apply the
intent sentence as a test. Three outcomes:

- **a. PASS survives.** The artefact satisfies both letter and intent. Log the
  intent sentence to the audit trail and move on. This is the common case and IS
  work — the logged intent sentence is the proof you did not skip the test.
- **b. Intent-test fails in a way the letter-test did not.** This is the gap.
  Capture four fields: (1) the artefact text/behaviour (quote / file:line); (2)
  why it satisfies the letter (one sentence); (3) why it fails the intent (one
  sentence); (4) the **structural reframing** the author would need to retract
  the PASS. The reframing field is load-bearing — a gap without a named
  reframing is a complaint, not a finding. The reframing names the concrete
  change (a new constructor parameter, a port, a wrapping-factory move) that
  makes *both* letter and intent pass, and names which lens the retracted PASS
  becomes a VIOLATION on.
- **c. Intent-test fails identically to the letter-test.** This is not a
  defended-on-intent gap; it is a letter-level VIOLATION another lens missed. Do
  not raise it here (that double-counts and dilutes this lens's signal). Note it
  as "letter-test-also-fails: defer to <source-lens>" and let the orchestrator
  route it back.

## Letter-vs-intent

This lens *is* the letter-vs-intent test, so its own catch-rate is the test's
fidelity. The canonical pattern: a rule's letter enumerates a specific mechanism
("module mocks are forbidden — these named mechanisms"), an artefact uses a
*different* mechanism not enumerated (a global stub, a monkey-patch, a
module-system reach-around) and the PASS reads "that mechanism is not on the
list, so the rule does not apply". The intent of the rule — derived from its
principle (e.g. "every dependency outside the unit boundary is faked through
dependency injection, never reached around") — is "no faking outside DI". The
unlisted mechanism *is* faking outside DI; it passes the letter and fails the
intent. The structural reframing: the unit consumes the dependency as an
injected port through its argument seam, production wires the real
implementation in the wrapping-factory file, the test injects a fake directly;
the PASS retracts and becomes a DI/testing VIOLATION on the owning lens.

The three properties that make a finding sound — and that an author can
reproduce from this procedure alone:

1. **The PASS was defensible at the letter.** The author was not careless; they
   ran the letter test correctly. The catch is not "you missed the letter" — it
   is "the letter and the intent had different denominators and you tested only
   one".
2. **The intent sentence is short, specific, principled.** One sentence; not a
   paraphrase of the letter; derivable from the governing principle without
   adversarial extension.
3. **The reframing is concrete.** It names the structural change that makes both
   tests pass, not just "this is wrong".

The decision is symmetric to the cost asymmetry that motivates firing this lens
early: a letter-only PASS caught while planning is one edit; the same gap caught
at interface-lock is a replan. When in doubt, ask: **would the PASS author
retract on reading my intent sentence and re-examining their artefact?** Yes →
gap. No → they'd defend it at the principle level too, and it is not a
letter-vs-intent gap.

## Output shape

Produce the counts the dispatching agent mandates:

- `pass-claims-tested=N` — every PASS claim in the bundle is either tested or
  explicitly excluded. A verdict without N means sampling, which is the exact
  laziness this lens exists to catch.
- `pass-claims-excluded=E` — each with a one-line reason (no artefact citation;
  cited clause does not exist; letter-test-also-fails deferred).
- `letter-vs-intent-gaps=K`.

Log the **full intent audit trail**: all N intent sentences, one line each
(`<rule-id> | intent sentence — my synthesis, no citation`), as the proof the
test was run on every claim, not sampled.

Each gap is reported with: the source-lens / constitution-check it came from,
the cited rule id, the clause letter (quoted, ≤2 lines), the intent sentence,
the artefact text defending on letter (`file:line | quoted code`), the
intent-test failure (one sentence), and the structural reframing the author
needs (naming which lens the retracted PASS becomes a VIOLATION on). State that
this lens loaded no numbered ruleset of its own and which constitution path you
resolved to look up cited clause text.
