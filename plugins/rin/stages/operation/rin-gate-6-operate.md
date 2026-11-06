---
slug: rin-gate-6-operate
number: 4.10
name: Gate 6 — Operate
plugin: rin
phase: operation
execution: ALWAYS
condition: The operational gate — genuinely missing from the original rin gates, which stop at merge. Establishes delivery of the merged Slice through the project procedure, verifies it live (health-checked against the real path, not state-at-rest), wires its monitoring, and closes the bookkeeping (tend-log breadcrumb, scope-routed decisions, backlog reconcile). Converges only when the Slice is provably live AND its record is closed.
lead_agent: rin-operations-agent
support_agents:
  - rin-pipeline-deploy-agent
  - rin-delivery-agent
mode: mob
approval_mode: autonomous
reviewer: rin-stage-reviewer-agent
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

Questions and actions in a reserved class follow
`{{HARNESS_DIR}}/knowledge/rin-gates/reserved-decisions.md`.

## Three concerns

### 1. Deployment

**The project owns how a release reaches its target; this gate owns proving that the required release is live.** Read the active space's `memory/project.md`, its `## Deployment` section and the project procedure it points to before taking any deployment action. The procedure identifies the target, release selection and currency rules, delivery mechanism, allowed trigger/recovery steps, required smoke checks, rollback and monitoring. Use the actual project pipeline and infrastructure files it names. If the procedure is missing, ambiguous or contradictory, record that exact gap and hold the action rather than inventing a deploy path. See `{{HARNESS_DIR}}/knowledge/rin-gates/ADOPTING.md` for the adoption contract.

The procedure decides whether this lane maintains target currency independently of Slice selection or verifies the selected Slice's release. Preserve that choice, including any project-wide convergence requirement; do not replace it with a hand-computed deployment scope. Bind the desired source revision, build/release identity and serving runtime using the project's evidence. A checkout, successful build or uploaded version is not proof that it is serving traffic. Records-only changes and provider path filters are interpreted by the project's release rules, not by a generic requirement to rebuild every commit.

Observe an existing CI/CD run before requesting another. When merge already triggered delivery, follow that run and its deployment/readback evidence. Do not redeploy a release already serving correctly just to perform this gate. A pending, failed, skipped, superseded or unconfirmed run is not successful delivery: establish the current state and use only the project's documented recovery when needed and authorized. Read back an uncertain result before retrying; a timeout or failed command does not prove that no external effect occurred.

`{{DEPLOY_COMMAND}}` is used only when the project procedure calls for that invocation. It is not the procedure, evidence of permission, or a mandatory extra step after CI/CD. Check every proposed trigger, promotion, retry, rollback or other mutation against the active reserved list before acting. Observation of an already-running or completed delivery does not itself authorize another action. A stopping class follows the existing question/pack/park contract in `reserved-decisions.md`; a configured command and autonomous stage mode do not lift it.

Record the procedure source, intended target/release, observed run or invocation, source/build/serving identities, rollback anchor, migration outcome and verification result in `rin-deployment-log.md`. Distinguish observed delivery from a newly requested deployment. If action is held, evidence is unavailable, delivery failed or rollback ran, say so without claiming the intended release is live.

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
not the board. `rin-stage-reviewer-agent` checks that the deployment log,
health-check report, runbook and bookkeeping close are complete and agree with
each other, and that the live verification forced the real path rather than a
green entry point.

## Steps

### Step 1: Establish delivery through the project procedure

Load the project procedure and identify the required target/release, its currency evidence and any existing delivery run. Apply its lane-wide or Slice-specific scope and its active reserved decisions. Verify an already-delivered release without triggering it again; wait for pending delivery, or perform only the authorized documented action/recovery. Missing procedure, held action, unresolved run state or failed delivery is recorded explicitly, never converted into success.

Before a new deployment or traffic change, establish the rollback anchor and recovery limits, including migrations that rollback will not undo. Capture the actual serving release after delivery, then record the procedure, target, release identities, run/invocation outcome, migrations, rollback and live-verification evidence in `rin-deployment-log.md`. A workflow's green status alone is insufficient if the required deployment or smoke checks were skipped.

### Step 2: Verify live + wire monitoring
Force the real path; read the side-effect. Write `rin-health-check-report.md` (live,
not at-rest) and `rin-operational-runbook.md` (monitoring + SLO + rollback).

### Step 3: Close the books
Write the session breadcrumb, any decisions (routed by scope per the
bookkeeping list above), and the backlog reconcile. Record them in
`rin-bookkeeping-close.md`.

### Step 4: Commit, push, and open the PR — same run, never at the primary
Commit the four record-dir artefacts on a WORKTREE BRANCH, push, and open the
PR the SAME RUN via `{{PR_COMMAND}}` (the affordance that opens a pull request for
the pushed branch under the author identity). Never commit at the primary checkout —
`guard-primary-commit` denies it deterministically. This scheduled lane spawns
into the primary checkout by default; move onto an agent worktree before
committing ({{WORKTREE_TOOL}}) — the session-start guide's
Worktree protocol carries the mechanics. The PR body lists every call this gate
made under a decided class, with its class and where it is recorded, for
{{OPERATOR}}'s sign-off.

Stop here — the conductor runs the reviewer, learnings, and approval; the stage's own `report --result approved` + committed audit event
is the operational-done record.

## Hard stops (no new deployment action, flagged digest - never a silent skip)

Hold before initiating or retrying a deployment action, and name the exact failing stop in the digest, when ANY of these hold:

- the project procedure is missing, ambiguous or contradictory, or does not identify the required target/release and method;
- a prerequisite the project procedure explicitly requires is missing, including access to the delivery control plane, necessary verification access or a required integration;
- a known deploy landmine is flagged for the Slice or required release (check the Slice body and project knowledge);
- the required live verification cannot force the real path this run, or the rollback/recovery plan is unavailable;
- the action falls in a stopping class on the active reserved list. Write the pack into `rin-deployment-log.md` and park, or, with {{OPERATOR}} present in the session, ask through the question contract (`{{HARNESS_DIR}}/knowledge/rin-gates/reserved-decisions.md`). Act only once {{OPERATOR}}'s own answer allows it.

An optional life-OS rollup failure does not block deployment or the engine's completion. Record its separate gap. Only a prerequisite the project procedure explicitly requires can hold the action on that basis.

For delivery already underway or completed outside this run, record the observed state and unmet checks honestly. A held gate does not undo an external deployment, and recovery is another action subject to the same procedure and authority. Never declare the required release live from a held, failed or unconfirmed result.

## Refuses (invariants)

- **Never declare operational from state-at-rest.** Force the live path first, then verify against the side-effect. A green healthcheck is not the capability; build, upload and serving traffic are distinct facts.
- **Use the project's deployment scope and currency rules.** Do not silently narrow whole-target convergence where the project requires it, broaden an explicitly selected release, or use generic infrastructure assumptions in place of the project procedure. Record unresolved currency as a gap, not success.
- **No duplicate deployment for ceremony.** Existing merge-triggered delivery may supply the evidence. A new invocation is required only when the documented procedure and observed state require it and the action is authorized.
- **No done-signal without a closed record.** The gate's completion (this stage's `report --result approved`) requires the intended release verified live, its required smoke checks and monitoring satisfied, and the three bookkeeping closes written. A live release with an unclosed record is not done; rollback to a prior release does not prove the intended Slice shipped.
- **Notes-surface writes go through that surface's own interface.** Never a disk write behind its back; if the interface is unavailable, keep the output inline and report the gap rather than writing where it will not be seen.
- **No DB state-transition call for this Slice.** Stage and lifecycle live in the engine's own record (Current Stage + committed audit event). The operational-done fact is that committed engine record, never a DB write.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
