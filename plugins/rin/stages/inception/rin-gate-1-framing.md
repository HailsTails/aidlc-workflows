---
slug: rin-gate-1-framing
number: 2.20
name: Gate 1 — Framing
plugin: rin
phase: inception
execution: ALWAYS
condition: Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, gets the answers, and writes back confirmed scope directly into the AIDLC requirements artefact. The lead frames; the architect and developer seats contribute work against the framing. Prose only; no solution is chosen here (Gate 2).
lead_agent: aidlc-product-agent
support_agents:
  - aidlc-architect-agent
  - aidlc-developer-agent
mode: mob
reviewer: aidlc-architecture-reviewer-agent
review_artifact: rin-requirements
reviewer_max_iterations: 2
approval_mode: autonomous
produces:
  - rin-requirements
  - rin-framing-questions
consumes:
  - artifact: rin-reconcile-report
    required: true
  - artifact: rin-readiness-verdict
    required: true
requires_stage:
  - rin-gate-0-reconcile
sensors:
  - required-sections
  - dd-1
  - dd-2
  - dd-7
  - upstream-coverage
scopes:
  - rin-gates
inputs: The Gate-0 reconcile report + readiness verdict, and the target Slice's intent
outputs: rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions with the human's answers), under this stage's record dir, engine-resolved
---

# Gate 1 — Framing (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual
(question flow, reviewer, learnings, approval, report) uniformly around this
stage. This file describes only the WORK: surface the load-bearing decisions,
capture the human's answers, and write confirmed scope into the native
requirements artefact. It does NOT present the gate or report.

This is rin Gate 1 — "frame, don't solve". The lead (`aidlc-product-agent`) is the framer: it surfaces the Slice's baked-in assumptions as atomic, non-dominated, consequence-bearing decision-questions. The two seats are this stage's `support_agents`, dispatched per the ensemble contract (`{{HARNESS_DIR}}/knowledge/rin-gates/ensemble-contract.md`), and each performs work rather than reviewing: the architect seat drafts the alternative framing and says what it would cost; the developer seat attempts the smallest implementation against the framing and reports where it does not fit. The lead arbitrates their evidence. The gate NEVER drafts the solution — choosing among solutions is Gate 2's — and NEVER pre-resolves a load-bearing decision; {{OPERATOR}} answers.

## Native artefact chain (no Spec-Kit)

Gate 1 writes its confirmed scope directly into the AIDLC **`rin-requirements`**
artefact (`rin-requirements.md`) — the plugin's namespaced counterpart of the same
artefact AIDLC's own requirements-analysis stage produces. There is no `spec.md`,
no `/speckit-specify`. BDD Given/When/Then acceptance criteria live in
`rin-requirements.md`. This is the pipeline's one substrate: the decision to
REPLACE Spec-Kit with AIDLC-native artefacts (see `{{HARNESS_DIR}}/rin-gates/README.md`
§ "Spec-Kit decision").

## The state transition this gate owns

The rin repo is the sole system of record for this Slice's stage and lifecycle.
When framing is confirmed and the requirements artefact is written, the gate's
transition is the engine's own `report --result approved` — it advances Current
Stage and writes a GATE_APPROVED / STAGE_COMPLETED audit event, committed
in-repo. The conductor fires this as part of the gate ritual; there is no
separate DB call and no receipt artefact.

## Steps

### Step 1: Frame, and convene the seats
The lead produces the decision-question set. The architect and developer seats perform their acts against it (above), and the lead folds what their evidence shows into the set. Questions must be atomic, non-dominated (no question whose answer forces another), consequence-bearing, and load-bearing (the answer changes the design). The solution is never proposed here, and the artefacts are prose only: a shape written as a type, a schema or a signature is a solution, and the board judges whether the artefacts carry one. A shape the framing needs to mention is recorded as a candidate for Gate 2, never as a requirement.

### Step 2: Get the human's answers
Present the decision-questions via the standard question flow (stage-protocol.md
§3). Log via `aidlc-log.ts`. Never self-answer a load-bearing decision; only a
rule-determined call with dominated alternatives is settled by the team.

### Step 3: Write confirmed scope into the requirements artefact
Fold the answers into `rin-requirements.md` (the native AIDLC requirements
artefact), Given/When/Then acceptance criteria per FR. Write
`rin-framing-questions.md` as the answered decision record.

Stop here — the conductor runs the reviewer (`aidlc-architecture-reviewer-agent`,
this gate's whole roster), learnings, and approval.

## Refuses (invariants)

- **Frame, never solve.** No plan, no design, no interface here.
- **Never pre-resolve a load-bearing decision.** Only fork-on-goal / amendment /
  uncovered-values reaches the human as an escalation; a rule-determined call with
  dominated alternatives is settled and advanced.
- **Native artefact only.** Confirmed scope lands in `rin-requirements.md`, never a
  `spec.md`.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
