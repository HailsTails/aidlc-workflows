---
name: rin-bugfix
plugin: rin
depth: Standard
keywords:
  - rin defect
  - failing repro
  - regression fix
description: Lean lane for a defect fix in existing behaviour, premise-proved by a failing repro — Gates 4, 5, escalates to rin-gates on tripwire
---

# rin-bugfix scope

## 1. Population

A defect fix in existing behaviour: the system does something other than what it was built to do, and the fix restores the intended behaviour rather than adding new behaviour. A defect is classified by the surface it breaks, which is why its entry is premise-gated rather than population-gated.

## 2. Gates kept, and the risk each catches

- **Gate 4 (implement)** — the fix itself, with the plan artefact carrying CD-37 coverage and the failing repro turning green.
- **Gate 5 (review-cycle)** — the **full** review board and the managed merge. **More load-bearing here than on product code, not less**: a small fix is the classic vehicle for a shared-contract change smuggled in as a one-liner, and `rin-pr-scope` exists to catch precisely that. Never dropped from this lane.

## 3. Gates dropped, and the known input each would restate

- **Gate 0 (reconcile)** — the failing test IS the reconcile: it re-derives the defect's existence live, every run, which is stronger than a record-level claim.
- **Gate 1 (framing)** — the intended behaviour is already specified; the defect is the gap between it and reality.
- **Gate 2 (plan-review)** — restoring specified behaviour has no design space.
- **Gate 3 (interface-lock)** — a fix conforms to the existing interface. If it needs a new one, it is not a fix.
- **Gate 6 (operate)** — a defect fix in the tree carries no deploy step of its own.

## 4. Entry rule

Premise-proof-gated and mechanical: **a failing regression test that reproduces the bug IS the premise proof.** No failing repro means no entry — the change escalates to `rin-gates` framing.

This is stricter than it looks, and deliberately so: absent a repro, the premise that a defect exists at all is itself unestablished, so the lane would be skipping framing on the strength of an unverified claim. The repro must fail before the fix and pass after; a test written after the fix, which has never been observed failing, does not discharge this and is the dark-test shape the family refuses.

**The small-file bound is 3 changed source files.** Test files and the repro itself do not count toward it. The bound carries a value here rather than being left to judgement because an unvalued bound is unfailable — a tripwire nobody can breach is a tripwire that does not exist, which is the defect this Slice already caught once in its own acceptance criteria.

## 5. Escalation tripwires

Each is marked **mechanical** or **judgement**. Any one reclassifies **the whole change** into `rin-gates` — not the offending file, the change.

- **[mechanical]** The diff touches a Gate-3-locked interface — any `IF-N` or `G3-N` obligation. Locked is scope, never waivable debt, and a lean lane does not get to reopen it; a lock moves only by the same ceremony that set it.
- **[mechanical]** The diff touches a shared contract surface: kernel ports, gateway schemes, or design-system primitives.
- **[mechanical]** The diff touches a governance path: `.claude/**`, `aidlc/spaces/*/memory/**`, guards, or CI.
- **[mechanical]** The diff exceeds the small-file bound stated in section 4 — more than 3 changed source files.

**A one-line fix that also edits a kernel port to make the fix work is reclassified**, because a shared-contract change patched from a lean lane is the exact defect the `rin-pr-scope` lens exists to block. The size of the local diff is not the question; the reach of the contract it touches is.

**A change qualifying for both this lane and `rin-harness`** (a guard defect is both) takes `rin-harness`, the stricter lane, because it keeps Gate 0. **A change qualifying for both this lane and `rin-dep-bump`** is resolved by its premise: a failing regression test as the premise is `rin-bugfix`; a version delta with the changelog as the premise is `rin-dep-bump`; both premises present escalates to `rin-gates`.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton` — there is no entry-rule field, no predicate, and no diff inspection. Selection is keyword matching or a bare `--scope <name>` validity check.

The entry rule and the tripwires above are therefore **enforced by the Gate-5 review board, not by the selector at entry** — the `rin-pr-scope` and `rin-pr-checkers` lenses are where they bite. This does not weaken them: a path-set test stays cheaply auditable by a reviewer reading the diff, which is why the mechanical shape is preferred. It relocates where the rule is honoured. The transpose buys stage selection only.

## 7. Lean-scope walk

This scope drops gates that kept gates name in `requires_stage` and `consumes`. Both resolve benignly, by two different mechanisms.

The dropped gates' orphaned **`requires_stage`** edges are vacuous **at walk time**: the forward walk (`nextInScopeStage`) never visits a SKIP stage, so the ordering edge is never evaluated. No `--doctor` selection-dropped-edge advisory is emitted for a scope-SKIPped stage — that advisory keys on *plugin* selection, not scope selection — so this file predicts none.

An absent required **`consumes`** yields `expected: true` when no producer is on this scope's path: designed, benign, the lean-scope shortcut. It yields `expected: false` when a producer IS on the path and the artefact is still missing, which the engine flags as a possible real gap. No run under this scope may produce `expected: false` on a legitimate path.
