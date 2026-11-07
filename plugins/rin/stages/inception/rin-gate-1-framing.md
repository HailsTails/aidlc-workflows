---
slug: rin-gate-1-framing
number: 2.20
name: Gate 1 — Framing
plugin: rin
phase: inception
execution: ALWAYS
condition: Second gate of the rin pipeline. Turns the Slice's assumption-laden intent into atomic, non-dominated, load-bearing decision-questions, settles them with its seats, and writes back confirmed scope directly into the AIDLC requirements artefact. The seats and the lead draft the framing together. Prose only; no solution is chosen here (Gate 2).
lead_agent: rin-product-agent
support_agents:
  - rin-architect-agent
  - rin-developer-agent
  - rin-customer-seat-agent
mode: mob
reviewer: rin-decorrelated-review-agent
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
outputs: rin-requirements.md (the confirmed scope, BDD Given/When/Then, as the native AIDLC requirements artefact — no spec.md) and rin-framing-questions.md (the load-bearing decision-questions, each with the gate's answer and its source, or its stopping class and pack, and the disposition of every seat objection), under this stage's record dir, engine-resolved
---

# Gate 1 — Framing (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual
(reviewer, learnings, approval, report) uniformly around this
stage. This file describes only the WORK: surface the load-bearing decisions,
settle them with the seats, and write confirmed scope into the native
requirements artefact. It does NOT present the gate or report.

This is rin Gate 1 — "frame, don't solve". The lead (`rin-product-agent`) and the seats frame the Slice together: they surface its baked-in assumptions as atomic, non-dominated, consequence-bearing decision-questions, each seat writing the pieces the ensemble contract (`{{HARNESS_DIR}}/knowledge/rin-gates/ensemble-contract.md`) names for this gate. The gate NEVER drafts the solution — choosing among solutions is Gate 2's — and NEVER leaves a load-bearing decision implicit. The lead and seats settle each one from evidence; only one in a stopping class reaches {{OPERATOR}} (`{{HARNESS_DIR}}/knowledge/rin-gates/reserved-decisions.md`).

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

### Step 1: Write the framing in the mob rounds
The seats and the lead write both artefacts in the mob rounds (`stage-protocol-ensemble.md` §5). Questions must be atomic, non-dominated (no question whose answer forces another), consequence-bearing, and load-bearing (the answer changes the design). The solution is never proposed here, and the artefacts are prose only: a shape written as a type, a schema or a signature is a solution, and the board judges whether the artefacts carry one. A shape the framing needs to mention is recorded as a candidate for Gate 2, never as a requirement.

Record in `rin-framing-questions.md` a disposition for every objection a seat raised in any round, as the ensemble contract's § "Objection dispositions" says.

### Step 2: Settle the decisions
Settle each decision-question on the stage. The lead answers it from the seats' evidence, the code, the upstream artefacts, the recorded decisions and the rules, and records the answer and its source in `rin-framing-questions.md`. Apply the fork test and the deciding-versus-stopping split in `{{HARNESS_DIR}}/knowledge/rin-gates/reserved-decisions.md` against the active list. A question in a class the active list marks decided and recorded is decided here, naming its class, and recorded for review; it is not asked. Only a question in a stopping class goes to {{OPERATOR}}: its pack is written into `rin-framing-questions.md`, then it is asked or the gate parks as that file says, never through the interactive question picker in a scheduled or dispatched run. On resume, it is settled only under that file's resume rule. This file is the gate's decision record, not the stage protocol's question flow: no blank `[Answer]:` tags and no question-count target.

### Step 3: Write confirmed scope into the requirements artefact
Fold the settled decisions into `rin-requirements.md` (the native AIDLC requirements
artefact): a decision that changes a requirement replaces it, with
Given/When/Then acceptance criteria per FR. `rin-framing-questions.md` is the
answered decision record.

Stop here — the conductor runs the board (`rin-decorrelated-review-agent`: this gate's
roster from `review-rosters.json`), learnings, and approval.

## Refuses (invariants)

- **Frame, never solve.** No plan, no design, no interface here.
- **Never leave a load-bearing decision implicit or unsourced.** Each one is settled
  on the stage with its source, or carries the stopping class that sends it to
  {{OPERATOR}}. A question in no stopping class is not asked.
- **Native artefact only.** Confirmed scope lands in `rin-requirements.md`, never a
  `spec.md`.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
