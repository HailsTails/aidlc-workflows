---
name: rin-dep-bump
plugin: rin
depth: Standard
keywords:
  - dependency bump
  - version bump
  - lockfile update
description: Lean lane for dependency version movement with no intended behaviour change — Gates 4, 5, escalates to rin-gates on tripwire
---

# rin-dep-bump scope

## 1. Population

Dependency version movement with no intended behaviour change.

The requirement is the upstream changelog. Nothing about what is wanted is in question: the version moves, and either the suite stays green or the bump is not a bump but a migration.

## 2. Gates kept, and the risk each catches

- **Gate 4 (implement)** — the version movement itself plus **mandatory green CI**, with the plan artefact carrying CD-37 coverage. CI is the whole premise-proof for this population: a bump asserts no behaviour changed, and the suite is what tests that assertion.
- **Gate 5 (review-cycle)** — the decorrelated review board and the managed merge. **More load-bearing here than on product code, not less**: a dependency bump changes code nobody in the review read, so the reviewer's job is the blast radius rather than the diff, and `rin-pr-checkers` is watching for a bump that quietly relaxes a check to stay green. Never dropped from this lane.

## 3. Gates dropped, and the known input each would restate

- **Gate 0 (reconcile)** — the lockfile is the live state; there is no record-level claim to re-derive.
- **Gate 1 (framing)** — the changelog IS the requirement.
- **Gate 2 (plan-review)** — there is no design space in a version number.
- **Gate 3 (interface-lock)** — the interface is upstream's, and this lane does not get to freeze it.
- **Gate 6 (operate)** — a bump takes effect at install, not at deploy.

## 4. Entry rule

Mechanical and diff-derived: **the change qualifies only if every changed path is `package.json` or `pnpm-lock.yaml`.**

One changed file outside that allow-set reclassifies **the whole change** into `rin-gates` — not the file, the change. A bump that needs a source file edited to keep compiling is a migration wearing a bump's clothes, and the lane that reviews it must be the one that framed it.

**Worked example — a coupled `@types/node` + `typescript` major pair.** A pair that compiles cleanly and touches only the two allowed paths qualifies. The same pair requiring a `.ts` edit to typecheck routes to `rin-gates`, and the refusal names the offending path.

**A bump requiring test-file changes escalates.** If the suite must be edited for the new version to pass, the bump has changed behaviour by definition, and the premise that no behaviour changed — the sole justification for skipping Gates 1 through 3 — is refuted.

## 5. Escalation tripwires

Each is marked **mechanical** or **judgement**. Any one reclassifies **the whole change** into `rin-gates` — not the offending file, the change.

- **[mechanical]** Any changed path outside `package.json` and `pnpm-lock.yaml`, test files explicitly included.
- **[judgement]** The change would **weaken, carve out, reconfigure, or narrow** a guard, a gate, a sensor, or a CI check in order to keep the suite green.
- **[judgement]** The upstream changelog names a breaking change affecting a surface this repo uses, whether or not the suite currently catches it. A green suite over an unread breaking change is an untested assertion, not a passing one.

**A change qualifying for both this lane and `rin-bugfix`** is resolved by its premise: a failing regression test as the premise is `rin-bugfix`; a version delta with the changelog as the premise is `rin-dep-bump`. **Both premises present** — a bump undertaken to fix a reproduced defect — escalates to `rin-gates`.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton` — there is no entry-rule field, no predicate, and no diff inspection. Selection is keyword matching or a bare `--scope <name>` validity check.

The entry rule and the tripwires above are therefore **enforced by the Gate-5 review board, not by the selector at entry** — the `rin-pr-scope` and `rin-pr-checkers` lenses are where they bite. This does not weaken them: a path-set test stays cheaply auditable by a reviewer reading the diff, which is why the mechanical shape is preferred. It relocates where the rule is honoured. The transpose buys stage selection only.

## 7. Lean-scope walk

This scope drops gates that kept gates name in `requires_stage` and `consumes`. Both resolve benignly, by two different mechanisms.

The dropped gates' orphaned **`requires_stage`** edges are vacuous **at walk time**: the forward walk (`nextInScopeStage`) never visits a SKIP stage, so the ordering edge is never evaluated. No `--doctor` selection-dropped-edge advisory is emitted for a scope-SKIPped stage — that advisory keys on *plugin* selection, not scope selection — so this file predicts none.

An absent required **`consumes`** yields `expected: true` when no producer is on this scope's path: designed, benign, the lean-scope shortcut. It yields `expected: false` when a producer IS on the path and the artefact is still missing, which the engine flags as a possible real gap. No run under this scope may produce `expected: false` on a legitimate path.
