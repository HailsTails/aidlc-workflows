---
slug: rin-gate-6-operate
number: 4.10
name: Gate 6 — Operate
plugin: rin
phase: operation
execution: ALWAYS
condition: The operational gate — genuinely missing from the original rin gates, which stop at merge. Deploys the merged Slice, verifies it live (health-checked against the real path, not state-at-rest), wires its monitoring, and closes the bookkeeping (tend-log breadcrumb, scope-routed decisions, backlog reconcile). Converges only when the Slice is provably live AND its record is closed.
lead_agent: aidlc-operations-agent
support_agents:
  - aidlc-pipeline-deploy-agent
  - aidlc-delivery-agent
mode: mob
approval_mode: autonomous
reviewer: aidlc-architecture-reviewer-agent
review_artifact: rin-bookkeeping-close
reviewer_max_iterations: 3
produces:
  - rin-deployment-log
  - rin-health-check-report
  - rin-operational-runbook
  - rin-bookkeeping-close
consumes:
  - artifact: rin-disposition-table
    required: false
requires_stage:
  - rin-gate-5-review-cycle
sensors:
  - required-sections
  - dd-1
  - dd-2
  - dd-7
scopes:
  - rin-gates
  - rin-ops
  - rin-unit
inputs: The merged Slice (its engine record — Current Stage + committed audit event, resolved from the intent record dir) and its disposition table
outputs: rin-deployment-log.md, rin-health-check-report.md (the LIVE-path verification), rin-operational-runbook.md (monitoring + rollback), rin-bookkeeping-close.md (tend-log + decisions + reconcile), and the gate's own completion record (this stage's `report --result approved` + committed audit event — the operational-done fact), under this stage's record dir, engine-resolved
---

# Gate 6 — Operate (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual around
this stage. This file describes only the WORK: deploy, verify live, wire
monitoring, close the books. It does NOT present the gate or report.

This is the operational gate — **genuinely missing from the original rin gates**,
which stop at merge and leave deploy, monitoring, and bookkeeping to happen
ad-hoc. It is AIDLC's `operation` phase, scoped to one Slice. It folds AIDLC's
operation stages (deployment-execution, observability-setup, feedback-optimization)
into the three post-merge concerns rin actually has.

## Three concerns

### 1. Deployment
**This lane's FIRST duty is {{DEPLOY_TARGET}}'s currency, not Slice selection.** Before
picking a Slice to work, read {{DEPLOY_TARGET}}'s deployed state against `origin/main` on
**two axes** — the checkout AND the built images. Check the checkout by HEAD;
check the images by comparing their age against the last commit touching
buildable source, never against HEAD — most commits are records-only, and
`up -d` correctly leaves containers untouched for those, so a HEAD-only
comparison misses a stale-images state (a build-phase abort can leave the
checkout current while the containers stay stale). Either axis behind means
deploy.

rin deploys via **Docker Compose on {{DEPLOY_TARGET}}**, driven by `{{DEPLOY_COMMAND}}` —
the affordance that converges the deploy target's whole stack to current `origin/main`,
prints a rollback anchor first, and is the only sanctioned production-deploy path
(the codified stand-in for a remote CI/CD build step). It pulls current `origin/main`
on the target's checkout and rebuilds + `up -d`s the WHOLE stack, converging it to main;
migrations run at container boot; rollback = checkout the anchor the tool prints,
rebuild, back to `main`. Gate 6 drives that deploy whenever either axis is behind
`origin/main` — the merged Slice supplies the rollout strategy and the record, not
the deploy's scope, and is never a precondition for running it — and logs it in
`rin-deployment-log.md` (deployed HEAD, rollback anchor, exit code, migration
outcome, live-verification result).

### 2. Monitoring + live verification
**Prove the live path — an entry point's success is not the system's capability.**
A green healthcheck proves the server booted, not that the Slice works: force the
real path (send real traffic so lazy init fires), then read the side-effect.
Record `rin-health-check-report.md` with the live verification (not state-at-rest),
and `rin-operational-runbook.md` with the monitoring required by the consumer's
operating specification (spans, metrics, alerting, the SLO/health signal, and the
rollback runbook). Account for confounds (stale cache, mid-deploy edits) before
reading a null result as decisive.

### 3. Bookkeeping resolutions
Close the record so the next session inherits a coherent state — the rin
session-end discipline, expressed as a gate:
- **session breadcrumb** — an atomic record of what shipped and anything
  outstanding, written to the project's chosen notes surface. If that surface is
  unavailable, keep the output inline and report the gap rather than falling back
  to a disk write it does not sanction.
- **decisions, routed by scope** — author once, others point (the space's
  `knowledge/README.md` states the model): a subsystem-scoped technical decision
  goes to that subsystem's `decisions.md` in the space knowledge layer, dated and
  WITH the reasoning, plus a one-line pointer in the space's `memory/project.md`
  under its Decided section; a Slice-scoped ruling goes to the intent record dir;
  only a non-code or cross-surface record belongs in the notes surface — one per
  decision, never appended to a monolith.
- **backlog reconcile** — reconcile this Slice's engine record (Current Stage +
  audit trail) against ground-truth (the Gate-0 groom, applied at close): mark
  the record consistent with the live state, surface any drift the deploy
  revealed.
`rin-bookkeeping-close.md` records the three closes with pointers to the written
artefacts.

## The done-signal this gate owns (repo-SoR)

The rin repo is the sole system of record for systems/pipeline work: stage and
lifecycle live in the engine's own record — Current Stage in `aidlc-state.md`
plus the committed audit event — not in an external DB. Gate 6 does **not**
call any DB state-transition. Its completion IS the engine's own gate
completion: on a live-verified deploy + closed books, the conductor's
`report --result approved` for this stage, committed in-repo with its audit
event, IS the operational-done record. There is no receipt, no receipt
scribe, and no done-check dependency for this fact — the committed engine
record is the machine-checkable "this Slice is live and its record is closed"
proof.

If a life-OS WorkItem is bound to this Slice, `done_check_task` remains
available as a separate, optional life-OS rollup call (it updates
the {{BACKLOG_STORE}} store's own leaf-completion bookkeeping) — but the pipeline's
operational-done state does not depend on it, and Gate 6 never blocks or
gates its own completion on that call succeeding.

## One reviewer

Gate 6 follows the deploy playbook and closes the books, so it has one reviewer,
not the board. `aidlc-architecture-reviewer-agent` checks that the deployment log,
health-check report, runbook and bookkeeping close are complete and agree with
each other, and that the live verification forced the real path rather than a
green entry point.

## Steps

### Step 1: Deploy
**Before selecting a Slice, check {{DEPLOY_TARGET}}'s currency against `origin/main` on
both axes** — the checkout (HEAD) and the built images (age vs the last commit
touching buildable source, not HEAD, since most commits are records-only). Either
axis behind means deploy. This currency check is the lane's first duty; it does
not wait on which Slice, if any, is selected.

Run the deploy tool: `{{DEPLOY_COMMAND}}` — the affordance that converges the deploy
target's whole stack to current `origin/main` and prints a rollback anchor, accepting
`--dry-run` to print the plan and the pending main delta first by convention, then the
real run. It is the only sanctioned production-deploy path.

**The deploy is TOTAL and IDEMPOTENT — it converges the whole stack to current
`origin/main`, never a computed per-Slice service delta.** Docker's layer cache
makes unchanged services near-instant no-ops and `up -d` only recreates a container
whose image or resolved config actually changed, so a blanket converge is cheap and
correct. Computing an "affected services" list is the failure class every past
operate incident belongs to (see the tool's own header) — do not reconstruct it.

Because the deploy is total, **it is not gated on a Slice**: the Slice supplies
rollout strategy (what to verify, what is risky, sequencing of sign-offs) and the
bookkeeping record, not the deploy's scope, and is never a precondition for
running it. If either currency axis is behind `origin/main`, the deploy runs —
Slice or no Slice, empty pool or parked Slice included; none of those states is a
reason to skip. Record the outcome in `rin-deployment-log.md`:
the pre-deploy rollback anchor the tool prints, the deployed HEAD, the tool's exit
code, and the live-verification result.

### Step 2: Verify live + wire monitoring
Force the real path; read the side-effect. Write `rin-health-check-report.md` (live,
not at-rest) and `rin-operational-runbook.md` (monitoring + SLO + rollback).

### Step 3: Close the books
Write the session breadcrumb, any decisions (routed by scope per the
bookkeeping list above), and the backlog reconcile. Record them in
`rin-bookkeeping-close.md`.

### Step 4: Commit, push, and open the PR — same run, never at the primary
Commit the three record-dir artefacts on a WORKTREE BRANCH, push, and open the
PR the SAME RUN via `{{PR_COMMAND}}` (the affordance that opens a pull request for
the pushed branch under the author identity). Never commit at the primary checkout —
`guard-primary-commit` denies it deterministically. This scheduled lane spawns
into the primary checkout by default; move onto an agent worktree before
committing ({{WORKTREE_TOOL}}) — the session-start guide's
Worktree protocol carries the mechanics.

Stop here — the conductor runs the reviewer, learnings, and approval; the stage's own `report --result approved` + committed audit event
is the operational-done record.

## Hard stops (no deploy, flagged digest — never a silent skip)

Stop BEFORE deploying, and name the exact failing stop in the digest, when ANY
of these hold:

- a life-OS rollup call (e.g. `done_check_task`) this Slice's WorkItem depends
  on is unauthenticated (the rollup could never be recorded — the pipeline's
  own operational-done record is unaffected, but the life-OS side would drift);
- {{DEPLOY_TARGET}} is unreachable over ssh;
- a known deploy landmine is flagged for the Slice or its services (check the
  Slice body and memory notes);
- the live verification cannot force the real path this run (a deploy that can
  only be checked state-at-rest is not verifiable, so it does not ship).

A held deploy is a correct outcome, recorded loudly; it is never "declared
live" and never silently dropped.

## Refuses (invariants)

- **Never declare operational from state-at-rest.** Force the live path first,
  then verify against the side-effect. A green healthcheck is not the capability.
- **Converge the whole stack; never compute an affected-services list.** The
  deploy tool is total and idempotent by design — unchanged services are cached
  no-ops and only genuinely-changed containers recreate. A hand-computed
  per-Slice service list is the failure class every past operate incident belongs
  to, and it is what made "no Slice is straightforward" read as "no deploy".
- **{{DEPLOY_TARGET}}'s currency is never nobody's job, and it is checked on both axes.**
  Checkout-vs-`origin/main` alone is not enough — a build-phase abort can leave
  the checkout current while the built images stay stale, so image age is
  compared against the last commit touching buildable source, not against HEAD.
  A run that ends with either axis behind and no deploy-tool failure (or hard
  stop) to show for it is a FAILED run — report it as lane failure, the same
  honesty class as UNMEASURED. Slice state — including an empty pool or a
  parked Slice — is never a reason not to deploy.
- **No done-signal without a closed record.** The gate's completion (this
  stage's `report --result approved`) requires the deploy verified live AND
  the three bookkeeping closes written — a live deploy with an unclosed
  record is not done.
- **Notes-surface writes go through that surface's own interface.** Never a disk
  write behind its back; if the interface is unavailable, keep the output inline
  and report the gap rather than writing where it will not be seen.
- **No DB state-transition call for this Slice.** Stage and lifecycle live in
  the engine's own record (Current Stage + committed audit event) — the
  operational-done fact is that committed engine record, never a DB write.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
