---
name: rin-ops
plugin: rin
guard_policy: strict
depth: Standard
keywords:
  - system operations
  - container health
  - compose config
description: Lean lane for operational work on the selected deployment target — Gates 4, 5, 6, escalates to rin-gates on tripwire
---

# rin-ops scope

## 1. Population

Operational work on {{DEPLOY_TARGET}}: runtime health, deployment configuration, DNS, ports, observability, CI capacity, and credentials.

The requirement arrives as a running system's observed state — a container that is down, a certificate that expired, a disk that filled. There is nothing to discover about what is wanted; the question is only what to change and whether it took effect.

## 2. Gates kept, and the risk each catches

- **Gate 4 (implement)** — the repo change when there is one, with its plan artefact carrying CD-37 coverage. See section 4 for the no-repo-diff obligation.
- **Gate 5 (review-cycle)** — the decorrelated review board and the managed merge for the repo-change subset. **More load-bearing here than on product code, not less**: ops changes reconfigure the surfaces everything else runs on, so `rin-pr-checkers` is reading infrastructure that gates every future deploy. Never dropped from this lane.
- **Gate 6 (operate)** — the primary gate for this population, carrying its whole discipline unchanged: the deploy-stops (target unreachable, a flagged deploy landmine, the live path unforceable this run), the never-declare-a-verdict-from-state-at-rest rule, and the two-axis currency check (the checkout **and** the built images, since a build-phase abort leaves the checkout current while containers stay stale).

## 3. Gates dropped, and the known input each would restate

- **Gate 0 (reconcile)** — the live system is the reconcile. Gate 6's own currency check reads {{DEPLOY_TARGET}} directly, which is stronger than a record-level sweep.
- **Gate 1 (framing)** — the requirement is the observed operational state.
- **Gate 2 (plan-review)** — infrastructure changes are bounded by the compose file and the box's actual configuration; there is no design space to review.
- **Gate 3 (interface-lock)** — nothing to freeze.

## 4. Entry rule

Mechanical: **every changed repo path lies in the infrastructure surface** (`infra/**`, compose files, deployment scripts) **or the change touches no repo path at all** and acts only on {{DEPLOY_TARGET}}.

**An engine record is minted only when the action changes PERSISTENT deployment state** — deployment config, credentials, DNS. A transient action (a restart, a re-run, a minutes top-up) is digest-only and mints no record: recording it as an intent would file bookkeeping for something with no durable subject.

**A no-repo-diff run still produces Gate 4's `rin-code-generation-plan`, recording that there is no repo change and why.** This is not bookkeeping — it is required for the walk to be clean. The grid has no conditional axis, so this scope compiles to Gates 4, 5 and 6 unconditionally; Gate 5 consumes `rin-code-generation-plan` with `required: true` and its producer Gate 4 **is on this path**. An absent artefact whose producer is on-path yields `expected: false` — the engine's real-gap branch, not the benign designed-absence one. A one-line plan recording "no repo change" makes the consume present, the walk clean, and the run honest about what it did.

Narrowing this scope to Gates 5 and 6 and routing repo-change ops work to `rin-harness` was considered and rejected: the ops population genuinely contains both kinds, and splitting one population across two lanes reintroduces the routing ambiguity the family's conflict rule exists to remove.

## 5. Escalation tripwires

Each is marked **mechanical** or **judgement**. Any one reclassifies **the whole change** into `rin-gates` — not the offending file, the change.

- **[judgement]** The change would **weaken, carve out, reconfigure, or narrow** a guard, a gate, a sensor, or a CI check.
- **[mechanical]** The change touches application or package source (`apps/**`, `packages/**`) — that is product work wearing an ops premise.
- **[mechanical]** The change touches the constitution surfaces: `aidlc/spaces/*/memory/**` or `**/knowledge/aidlc-shared/code-discipline/**` (the maintained `plugins/rin/` home and its composed `.claude/` copy).
- **[judgement]** The action is irreversible and unrehearsed — a destructive data operation, or a cutover with no rollback step. Gate 6's deploy-stops bound the deploy; a change whose failure mode is unrecoverable belongs in the full pipeline.

**A change qualifying for both this lane and another** escalates to `rin-gates` whenever the two kept-gate sets are non-comparable. This is a live path, not a hypothetical: this scope keeps Gates 4, 5 and 6 while `rin-audit` keeps 0, 4 and 5, so neither contains the other and an audit paydown that is also an ops deploy goes to the full pipeline today.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton` — there is no entry-rule field, no predicate, and no diff inspection. Selection is keyword matching or a bare `--scope <name>` validity check.

The entry rule and the tripwires above are therefore **enforced by the Gate-5 review board, not by the selector at entry** — the `rin-pr-scope` and `rin-pr-checkers` lenses are where they bite. This does not weaken them: a path-set test stays cheaply auditable by a reviewer reading the diff, which is why the mechanical shape is preferred. It relocates where the rule is honoured. The transpose buys stage selection only.

## 7. Lean-scope walk

This scope drops gates that kept gates name in `requires_stage` and `consumes`. Both resolve benignly, by two different mechanisms.

The dropped gates' orphaned **`requires_stage`** edges are vacuous **at walk time**: the forward walk (`nextInScopeStage`) never visits a SKIP stage, so the ordering edge is never evaluated. No `--doctor` selection-dropped-edge advisory is emitted for a scope-SKIPped stage — that advisory keys on *plugin* selection, not scope selection — so this file predicts none.

An absent required **`consumes`** yields `expected: true` when no producer is on this scope's path: designed, benign, the lean-scope shortcut. It yields `expected: false` when a producer IS on the path and the artefact is still missing, which the engine flags as a possible real gap. No run under this scope may produce `expected: false` on a legitimate path — which is precisely why section 4 requires the no-repo-diff plan artefact.
