---
slug: rin-gate-4-implement
number: 3.10
name: Gate 4 — Implement
plugin: rin
phase: construction
execution: ALWAYS
condition: Implements the locked Slice test-first (TDD) and runs the committed deterministic gate + constitution supervision, then reports the gate's own `report --result approved` transition — the pre-spec→construction handoff boundary. Entry is gated on the engine's `requires_stage`/`consumes` chain against Gate 3's committed artefacts. Gate 5 (review cycle) owns the merge that follows, not here.
lead_agent: aidlc-developer-agent
support_agents:
  - rin-test-seat-agent
  - rin-build-seat-agent
mode: mob
workspace_requires: true
approval_mode: autonomous
reviewer: rin-decorrelated-review-agent
review_artifact: rin-code-generation-plan
reviewer_max_iterations: 2
produces:
  - rin-code-generation-plan
  - rin-code-summary
consumes:
  - artifact: rin-interface-lock
    required: true
  - artifact: rin-requirements
    required: true
requires_stage:
  - rin-gate-3-interface-lock
sensors:
  - format
  - linter
  - type-check
  - cd-1
  - cd-2
  - cd-6
  - cd-8
  - cd-14
  - cd-15
  - cd-17
  - cd-19
  - cd-23
  - cd-25
  - cd-26
  - cd-27
  - cd-43
  - cd-44
  - carve-out-decay
  - dd-1
  - dd-2
  - dd-7
scopes:
  - rin-gates
  - rin-harness
  - rin-audit
  - rin-ops
  - rin-dep-bump
  - rin-bugfix
  - rin-unit
inputs: The Gate-3 frozen interface bundle, the requirements (from the approved parent for `rin-unit`), and Gate-3's committed `report --result approved` completion (construction-entry gate)
outputs: application code in the workspace + rin-code-generation-plan.md (the implementation plan — the native replacement for tasks.md) and rin-code-summary.md, under this stage's per-Slice record dir, engine-resolved
---

# Gate 4 — Implement (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual
(reviewer, learnings, approval, report) uniformly around this stage. This file
describes only the WORK: implement the locked Slice test-first and drive the
committed deterministic gate. It does NOT present the gate or report.

This is rin Gate 4 — TDD implement. The conductor leads and convenes a pair of seats (`mode: mob`, seats dispatched per the ensemble contract) that ping-pong each task one behaviour group at a time: the test seat writes the failing tests, the build seat writes the least code that passes them. A third agent that wrote none of the code checks each commit before it lands. The deterministic gate stays COMMITTED tooling — the automatable work is committed, not re-spawned.

Small rounds are the point. Each round surfaces a mistake before the next round builds on it, so the pair reaches a correct result faster than one agent taking large steps, and rework (the largest cost in construction) stays small.

## Construction entry is gated on Gate 3's committed completion

Gate 4 is the pre-spec→construction handoff. Its entry is gated two ways,
both engine-native and both proven by what is committed in-repo:

1. `requires_stage: [rin-gate-3-interface-lock]` — the engine's no-forward-skip
   guard refuses Gate 4 until Gate 3 completes at its approval gate (Gate 3's
   own `report --result approved`, recorded as a STAGE_COMPLETED/GATE_APPROVED
   audit event and reflected in the intent's `aidlc-state.md`).
2. `consumes: rin-interface-lock (required: true)` (+ `rin-requirements`) — the
   frozen Gate-3 interface bundle and requirements are required inputs. On a
   `rin-unit` record, Gate 1 is off the scope path, so the engine reports the
   absent local `rin-requirements` as `expected: true`. The unit reads its
   requirements from the approved parent instead. The engine's own entry proof
   covers the unit's Gate 3; it does not prove that parent input.

For `rin-unit`, the lead resolves the parent and unit named in the unit record's
opening line on fetched `origin/main` before writing a plan. Read the parent's
`rin-requirements.md` and the `rin-components.md` that marks the unit for
separate delivery. Check the parent's committed state and audit for approval of
Gate 1 and of the gate that produced those components; an earlier approval
superseded by a current re-run is insufficient. Confirm that the approved
requirements frame the marked unit's work and that the unit's own approved
Gate-3 lock covers the contracts the plan will implement. If the
parent, either approval, the unit marker, or that relationship cannot be
established, stop before planning and route the gap to the parent. This is a
lead and review-board judgement under `{{HARNESS_DIR}}/scopes/rin-unit.md`, not an
automated parent lookup or a new receipt.

## Native artefact chain (no Spec-Kit)

The implementation plan lives in the AIDLC **`rin-code-generation-plan`** artefact —
the native replacement for `tasks.md`. There is no `/speckit-tasks`. The Spec-Kit
`.gate-lock`→`tasks.md` boundary is gone; the boundary here is Gate 3's committed
approval + the frozen interface bundle.

## The state transition this gate owns

The rin repo is the sole system of record for this transition. On a passing gate
+ constitution-conform supervisor verdict, the conductor fires the engine's own
`report --result approved` — recording Current Stage + a STAGE_COMPLETED /
GATE_APPROVED audit event, committed in-repo. That IS the transition and its
proof. There is no DB call and no receipt to write.

Gate 4 STOPS at its own completed report. The transition on to review/merge
belongs to **Gate 5 (review cycle)** — the reviewer↔author round-trip converges
there before anything merges. Do NOT report Gate 5's completion here; that would
skip review.

Under the run-to-merged model, stopping at Gate 4's completion is a HAND-OFF TO
GATE 5 **IN THE SAME RUN**, not a stop-and-strand-for-a-later-lane: a pipeline run
drives the Slice consecutively, so the engine walks straight on to Gate 5, which
owns the review + merge. (Slice `019f5565`.) The old "end at a pushed PR — leave
for the next scheduled implement/review lane" framing is retired; the run
continues.

## Steps

### Step 1: Plan
From the frozen interface bundle + requirements, write `rin-code-generation-plan.md`
(the implementation plan — native tasks replacement). Every change traces to a
plan entry (CD-37). For `rin-unit`, use the verified parent's requirements and
the unit's approved lock; trace plan entries to both without creating a local
requirements copy.

#### Breaking the work into tasks

A task is one behaviour group that one red-green round covers. Before a row is final, the test seat could list its failing tests from the row and the lock alone. A row that cannot be read that way is not a task yet.

- **One kind of change per task.** New behaviour, switching existing callers onto it, retiring what it replaces, and rewriting tests are four kinds. A row holding two of them is split.
- **A row names behaviour, not a list of things to touch.** "Retire X, Y and Z", "every other caller" or "the rest" marks a bucket. Uniform work, many callers of one shape, is one task with one parameterised proof. Distinct work is distinct tasks. A row never pairs one small item with the remainder.
- **Walk each row against the lock's fences before construction.** Name every input the change needs and where it comes from, and every layer rule the change crosses. A decision the lock leaves open is settled in the plan or raised before construction starts, not found mid-task.
- **No task builds what a later task in the same change replaces.** If the order would force a stand-in, reorder the tasks or build the final form earlier.
- **A retirement rides with the task that removes the last caller,** never a trailing clean-up task that sweeps what several tasks left behind.
- **The proof names the test that fails without the change.** "Typecheck" or "goldens unchanged" proves nothing regressed. It does not prove the change.
- **Test quality is written into each task,** never deferred to a whole-package consolidation task at the end.
- **Reach deployed value before tidying, but cut only scope the Slice does not need.** Clean-up of problems the Slice itself introduced stays in the Slice. Clean-up of code that predates it can move out, captured as its own work.

A good breakdown is the main saving. Stand-ins later replaced, decisions overturned mid-build and tasks re-planned twice cost more than any model choice.

### Step 2: Ping-pong pairing, task by task

#### Roles

- **Lead (the conductor):** plans the tasks, dispatches the seats, settles decisions the lock leaves open, runs the per-commit check and commits. The lead does not write the code or the tests it is judging.
- **Test seat (`rin-test-seat-agent`):** writes the failing tests for a behaviour, against the lock's interfaces.
- **Build seat (`rin-build-seat-agent`):** writes the least code that makes those tests pass.

Each seat's own definition carries its role's rules, so every seat and check is dispatched as its own agent. Never substitute a general-purpose agent.

The pairing is the seats' act under the ensemble contract. Each seat records its rounds in its own contribution file: the tests or code it wrote, the commands it ran, and what they showed. Ping-pong is serial and each seat reads the other's hand-off, so the mob topology's parallel, mutually blind round does not apply at this gate.

#### The loop

Every task runs as a pair, one behaviour group at a time:

1. The test seat writes the failing tests and shows each one failing on behaviour. A missing module is not a failure: where the code does not exist yet, the build seat first adds the bare signature.
2. The build seat writes the least code that makes them pass. It raises back any test the lock does not ask for, and any test of a library, a constant or the type system.
3. They alternate until the task is done.

Rules for the pair:

- **One seat edits at a time.** The hand-off message names the files touched.
- **Disagreements** are raised once to the other seat. If one stands, it goes to the lead, who decides. A decision the lock does not settle goes straight to the lead.
- **Push back on the lead too.** A seat that finds the task row wrong against the code says so, with the evidence; for example, a row asking for something another component already does. The lead corrects the plan rather than defending the wording.
- **Check before claiming.** Before naming anything to delete or change, the seat finds everything that still uses it. Plan descriptions are checked against the code, not trusted.
- **A test for behaviour that already exists** passes at once. Break the code briefly to watch that one test fail, then restore it. That is the only case where a deliberate break is used.

#### Checks

Before every hand-off, the seat holding the work runs the full checks: the package's own `typecheck` and `test` scripts, `pnpm lint`, and the constitution audit (`pnpm audit:harness`, plus the package's own `audit` script where it has one). It hands off only work they pass, apart from the new failing tests. These checks are cheap and deterministic, so narrowing them saves nothing. At the end of a task, whoever holds the work runs them again and reports the result to the lead.

#### Hand-offs and seat lifetime

- **Compact hand-offs for bounded rows.** Where a row's text and the lock sections it cites settle everything, the seat reads only its row, those lock sections, and the last hand-off. A row carrying a decision the lock leaves open gets the full context.
- **Start a seat when it has work.** Do not start the build seat early to wait for the test seat's hand-off; waiting still spends tokens on reading. Start or resume it when the hand-off arrives.
- **Keep a working pair for consecutive tasks of the same kind,** resuming the same seats so they carry context forward instead of re-reading it.

#### Per-commit check and commits

- One commit per pair of tasks, after both seats agree the tasks are done.
- Before each commit, the lead dispatches `rin-commit-check-agent` against the diff, with the head sha pinned. It wrote none of the code and looks only for what both authors could miss: behaviour the lock asks for with no test, a state the code can get stuck in, and tests with no value.
- It reports only blocking findings. The pair fixes those before the commit. Anything smaller is recorded in `rin-code-summary.md` for review, not fixed now.
- It is not the gate's review. At stage completion the conductor runs the decorrelated board over the code diff and this plan, dispatching this gate's roster from `review-rosters.json`.

The blocking deterministic verdict is the `rin-constitution-gate` hook at stage completion, and the pre-push lefthook legs execute repo-wide on the tree itself.

Stop here — the conductor runs the reviewer, learnings, and approval. The
approval step's `report --result approved` IS Step 3: there is no separate DB
advance to perform.

## Refuses (invariants)

- **The gate is committed tooling, not a re-spawned judge.** Producers write
  files; the deterministic gate is the `rin-constitution-gate` hook plus the
  pre-push lefthook legs and CI.
- **Never report approval on a red gate.** The `report --result approved` call
  requires a passing gate + conform verdict. The merge transition is NOT this
  gate's to report — it is Gate 5's, after the review round-trip converges.
- **Locked interfaces are scope.** Do not re-widen an IF-N frozen at Gate 3.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
