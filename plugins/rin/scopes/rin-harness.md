---
name: rin-harness
plugin: rin
guard_policy: strict
depth: Standard
keywords:
  - harness change
  - gate tooling
  - rin hook
description: Lean lane for changes to rin's own delivery machinery — Gates 0, 4, 5, escalates to rin-gates on tripwire
---

# rin-harness scope

## 1. Population

Changes to rin's own delivery machinery: gate stages, the engine and its wrappers, hooks and guards, scopes, reviewer lenses, worktree and session tooling, `plugins/rin/**` and `.claude/**`, bot identity and the `gh:*` wrappers, audit shards, merge drivers.

Bounded harness changes use this scope's premise checks to retain gate discipline without repeating product framing and interface design.

## 2. Gates kept, and the risk each catches

- **Gate 0 (reconcile)** — harness claims go stale faster than any other population's, because the machinery they describe is the machinery everyone else keeps changing. Gate 0 re-derives the live state before work begins, so a task body asserting a guard's behaviour is checked against the guard rather than actioned on trust.
- **Gate 4 (implement)** — the implementation itself, with its plan artefact carrying CD-37 coverage.
- **Gate 5 (review-cycle)** — the decorrelated review board and the managed merge. **This gate is MORE load-bearing here than on product code, not less**: harness work modifies the very checks that gate everything else, so the `rin-pr-checkers` lens is reading a diff that can weaken every future Slice's enforcement. It is never dropped from this lane.

## 3. Gates dropped, and the known input each would restate

- **Gate 1 (framing)** — the requirement arrives already written: an existing tool's CLI contract, a hook's current behaviour, a recorded ruling, a failing run. Framing would restate a source document nobody needed restated.
- **Gate 2 (plan-review)** — there is no design space to review when the change is bounded by an existing mechanism's shape.
- **Gate 3 (interface-lock)** — nothing to freeze: the interface is whatever the surrounding harness already exposes.
- **Gate 6 (operate)** — harness changes are not deployed to {{DEPLOY_TARGET}}. They take effect in the next session that loads them, so there is no deploy step and no live path to force.

## 4. Entry rule

Mechanical, applied to the change's file list: **every changed path lies within the harness surface** — `plugins/rin/**`, `.claude/**`, `scripts/**`, `lefthook.yml`, `.github/**`, `infra/github-apps/**`, or the `gh:*` / gate wrapper scripts in `package.json`.

A change touching application or package source (`apps/**`, `packages/**`) is not harness work and does not enter this lane.

## 5. Escalation tripwires

Each is marked **mechanical** (a path-set or diff test a reviewer applies to a file list) or **judgement** (requires reading intent). Any one of them reclassifies **the whole change** into `rin-gates` — not the offending file, the change.

- **[judgement]** The change would **weaken, carve out, reconfigure, or narrow** a guard, a gate, a sensor, or a CI check. This is the one harness change whose blast radius is every future Slice, and it is exactly what `rin-pr-checkers` exists to catch.
- **[mechanical]** The change touches **`plugins/rin/scopes/**`** — the scope files themselves.
- **[mechanical]** The change touches **`.claude/tools/data/scope-grid.json`** or **`.claude/hooks/rin-gates-autonomy-gate.ts`** — the autonomy backstop's covered-set definition and the guard itself.
- **[mechanical]** The change touches the constitution surfaces: `aidlc/spaces/*/memory/**` or `**/knowledge/aidlc-shared/code-discipline/**` (the maintained `plugins/rin/` home and its composed `.claude/` copy).

**The scope-file tripwire is reflexive, and deliberately so.** This lane's own charter is `rin-harness` work, so once the family lands, future edits to these five scope files would themselves run under `rin-harness` — a lane with no Gate 1. Editing an entry rule is a governance act, and a lane able to silently widen its own entry rule without framing is a self-amending gate. Routing scope-file changes to `rin-gates` closes that loop.

**The loop closes over the guard's DEFINITION, not only over the authored rules.** The covered set of the autonomy backstop derives from `.claude/tools/data/scope-grid.json`, which makes that file the guard's covered-set definition rather than mere derived documentation. Two single-file edits would otherwise un-cover a lane from inside this lane: flipping a row's `rin-gate-5-review-cycle` cell to `SKIP`, or deleting the grid outright. Naming both paths mechanically means neither depends on a reviewer *reasoning* that a one-cell JSON diff weakens a guard. The tripwire fires on **any** change to the grid, a composer append included — the file is load-bearing for the guard whatever wrote it.

**The bet this lane makes, stated plainly.** Routing 60% of the backlog through a lane with no requirements artefact is defensible only because the status quo for that population is no gate discipline at all. Where a harness change genuinely has no pre-written specification — a reviewer lens or a gate stage's judgement rules, unlike a tool's CLI contract or a CD rule — the author escalates to `rin-gates` rather than implementing against an unwritten requirement.

**A change qualifying for both this lane and `rin-bugfix`** (a guard defect is both) takes `rin-harness`, the stricter lane, because it keeps Gate 0. **A change that is also a CD-46 file-cluster paydown** takes `rin-audit`; otherwise harness work stays here.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton` — there is no entry-rule field, no predicate, and no diff inspection. Selection is keyword matching or a bare `--scope <name>` validity check.

The entry rule and the tripwires above are therefore **enforced by the Gate-5 review board, not by the selector at entry** — the `rin-pr-scope` and `rin-pr-checkers` lenses are where they bite. This does not weaken them: a path-set test stays cheaply auditable by a reviewer reading the diff, which is why the mechanical shape is preferred. It relocates where the rule is honoured. The transpose buys stage selection only.

## 7. Lean-scope walk

This scope drops gates that kept gates name in `requires_stage` and `consumes`. Both resolve benignly, by two different mechanisms.

The dropped gates' orphaned **`requires_stage`** edges are vacuous **at walk time**: the forward walk (`nextInScopeStage`) never visits a SKIP stage, so the ordering edge is never evaluated. No `--doctor` selection-dropped-edge advisory is emitted for a scope-SKIPped stage — that advisory keys on *plugin* selection, not scope selection — so this file predicts none.

An absent required **`consumes`** yields `expected: true` when no producer is on this scope's path: designed, benign, the lean-scope shortcut. It yields `expected: false` when a producer IS on the path and the artefact is still missing, which the engine flags as a possible real gap. No run under this scope may produce `expected: false` on a legitimate path.
