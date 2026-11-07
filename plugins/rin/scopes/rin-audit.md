---
name: rin-audit
plugin: rin
guard_policy: strict
depth: Standard
keywords:
  - constitution paydown
  - carve-out retirement
  - cd violation
description: Lean lane for constitution-compliance paydown — Gates 0, 4, 5, escalates to rin-gates on tripwire
---

# rin-audit scope

## 1. Population

Constitution-compliance paydown: CD violations, carve-out retirement, authorised-location moves, and walker or audit-scope defects.

The requirement for this work is never discovered — it is written down. A CD rule states the obligation, and the walker states where the code fails it. What varies is which files are coupled, and that is a derivation, not a design question.

## 2. Gates kept, and the risk each catches

- **Gate 0 (reconcile)** — mandatory and load-bearing here. The live violation set is **re-derived before work begins, never read from a ledger quote or a task body**. Audit claims decay faster than they are recorded: a task body asserting "4 authored classes still present" is a measurement taken at capture time, and the code has moved since. A claim already false at read time is recorded as refuted rather than actioned.
- **Gate 4 (implement)** — the paydown itself, with its plan artefact carrying CD-37 coverage.
- **Gate 5 (review-cycle)** — the decorrelated review board and the managed merge. **More load-bearing here than on product code, not less**: a paydown diff touches the audit surfaces themselves, so `rin-pr-checkers` is reading exactly the class of change that can narrow the checks it is verifying. Never dropped from this lane.

## 3. Gates dropped, and the known input each would restate

- **Gate 1 (framing)** — the CD rule IS the requirement. Framing would paraphrase a rule that already exists in its canonical atomic file.
- **Gate 2 (plan-review)** — the design space is the rule's own prescription; there is nothing to weigh.
- **Gate 3 (interface-lock)** — a paydown conforms an existing interface to a rule rather than freezing a new one.
- **Gate 6 (operate)** — nothing deploys. Compliance takes effect in the tree, not on {{DEPLOY_TARGET}}.

## 4. Entry rule

Mechanical: **the change's premise is a named CD violation or a named carve-out**, and every changed path is either a file the walker reports for that CD, a file coupled to it by CD-46 touch-closure, or the carve-out surfaces themselves (`.constitution-carve-outs/*.json` and the ledger entry).

The unit of work is the **coupled file cluster, not the CD id**. CD-46 forfeits a file's carve-out the moment the diff touches it, so the slice boundary is drawn around files that must move together — a per-CD slice that touches half a cluster leaves the other half in forfeited-but-unpaid limbo.

Paydown strips **both** carve-out surfaces: the ledger entry and the live `.constitution-carve-outs/*.json` mirror. An exemption that turns out to be fully allowed becomes an **authorised location**, not a carve-out — they are different directories with different rules, and converting one to the other is the correct discharge rather than a dodge.

## 5. Escalation tripwires

Each is marked **mechanical** or **judgement**. Any one reclassifies **the whole change** into `rin-gates` — not the offending file, the change.

- **[judgement]** The paydown would **weaken, carve out, reconfigure, or narrow** a walker, a guard, a sensor, or the audit's own scope. A red gate is fixed in-slice, never carved: a rule cannot mandate the violation it forbids, and every route that "resolves" a blocking control by widening it is the defect rather than the fix.
- **[mechanical]** The change touches the constitution surfaces: `aidlc/spaces/*/memory/**` or `**/knowledge/aidlc-shared/code-discipline/**` (the maintained `plugins/rin/` home and its composed `.claude/` copy). Amending a rule is not paying it down.
- **[mechanical]** The change touches `harness.config.json` — the audit's include/exclude scope. Widening or narrowing what is audited is a governance act.
- **[judgement]** The cluster's touch-closure grows unboundedly: newly-visible inherited debt is **carved and queued**, not paid inside the slice that reveals it. If the closure cannot be bounded, the slice re-enters framing rather than absorbing an open-ended paydown.

**A change qualifying for both this lane and `rin-harness`** takes `rin-audit` when the unit of work is a CD-46 file cluster; otherwise it takes `rin-harness`.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton` — there is no entry-rule field, no predicate, and no diff inspection. Selection is keyword matching or a bare `--scope <name>` validity check.

The entry rule and the tripwires above are therefore **enforced by the Gate-5 review board, not by the selector at entry** — the `rin-pr-scope` and `rin-pr-checkers` lenses are where they bite. This does not weaken them: a path-set test stays cheaply auditable by a reviewer reading the diff, which is why the mechanical shape is preferred. It relocates where the rule is honoured. The transpose buys stage selection only.

## 7. Lean-scope walk

This scope drops gates that kept gates name in `requires_stage` and `consumes`. Both resolve benignly, by two different mechanisms.

The dropped gates' orphaned **`requires_stage`** edges are vacuous **at walk time**: the forward walk (`nextInScopeStage`) never visits a SKIP stage, so the ordering edge is never evaluated. No `--doctor` selection-dropped-edge advisory is emitted for a scope-SKIPped stage — that advisory keys on *plugin* selection, not scope selection — so this file predicts none.

An absent required **`consumes`** yields `expected: true` when no producer is on this scope's path: designed, benign, the lean-scope shortcut. It yields `expected: false` when a producer IS on the path and the artefact is still missing, which the engine flags as a possible real gap. No run under this scope may produce `expected: false` on a legitimate path.
