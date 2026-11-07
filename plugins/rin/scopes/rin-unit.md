---
name: rin-unit
plugin: rin
guard_policy: strict
depth: Standard
description: Lane for delivering one unit a parent record's approved design marked for separate delivery — enters at Gate 3 and runs Gates 3, 4, 5, 6
---

# rin-unit scope

## 1. Population

One **unit** of a parent record's work. A unit is a component that the parent's approved `rin-components` explicitly marks for separate delivery, together with its dependencies on other units. A component the parent did not mark is not a unit.

Each unit becomes its own record under this scope. It enters the pipeline at Gate 3 and consumes the design the parent already approved, rather than re-running Gates 0 to 2. The parent marks the units and their dependencies; each unit's own Gate 3 measures its premises and specifies the exact contracts for its piece. The parent's later gates cover only what no unit carries.

## 2. Gates kept, and the risk each catches

- **Gate 3 (interface-lock)** — the unit's premises are measured and its contracts specified before anything is built. A unit that skipped Gate 3 would build on the parent's design without measuring it for its own piece.
- **Gate 4 (implement)** — the unit's implementation, with its plan artefact carrying CD-37 coverage.
- **Gate 5 (review-cycle)** — the full review board and the managed merge. Each unit gets its own verdict and its own merge, so no unit ships without a gate approval of its own.
- **Gate 6 (operate)** — the deploy, live verification and bookkeeping close, as for any delivered Slice.

## 3. Gates dropped, and the parent input each would restate

- **Gate 0 (reconcile)** — the parent's Gate 0 already reconciled the work this unit belongs to.
- **Gate 1 (framing)** — the parent's requirements frame the whole; a unit is a piece of them.
- **Gate 2 (plan-review)** — the parent's approved design chose the solution and marked the units. Re-running it per unit would fork the parent's design.

## 4. Entry rule

- **The record's opening line names the parent record and the unit** it picks up, as the parent's `rin-components` marks it. It is plain prose, readable by people and lanes; nothing parses it.
- **The parent gate that produced that `rin-components` is approved on `main`.**
- **The unit is born with the engine's own verb**, with the parent line first in `--arguments`:

  ```
  bun {{HARNESS_DIR}}/tools/aidlc-utility.ts intent-create --scope rin-unit --label "<unit label>" \
    --arguments "Unit of <parent record dir>: <unit as the parent's rin-components marks it>. <what this unit delivers>"
  ```

- **The unit's premises live in its own `facts.md`.** At Gate 3 the unit restates the parent's design premises that its piece relies on as rows in its own `facts.md`, with their re-derivations, and measures them there.

## 5. Escalation tripwires

Either one reclassifies **the whole change** out of this scope.

- **[judgement]** The unit needs a design choice its parent did not make. That is new design space: it goes back to the parent, or into `rin-gates`, and never into a unit.
- **[mechanical]** The unit's diff touches an authored file in its parent's record. The change goes into `rin-gates`.

**Route-back.** A unit whose Gate 3 finds one of its parent's premises failing routes back to the **parent**. It does so through a new intent, or through the parent's own backward jump, which is fired by the parent's own run and never from a unit's worktree. Where the Gate-3 stage carries its own route-back to Gate 2 (as it does once #923's Gate 3 lands), this rule takes precedence, because that route-back would target a stage the unit record skips.

## 6. Enforcement

**No code reads this entry rule.** `loadScopeMapping` builds a scope definition from `depth`, `stages`, `keywords`, `description`, `testStrategy`, `plugin`, `runner` and `skeleton`. It has no entry-rule field, no predicate and no parent lookup. Three things are judged by the Gate-5 review board (`rin-pr-scope`, `rin-pr-claims`) and by lane discipline:

- the parent line;
- the approval of the parent's gate;
- the untouched parent.

The scope carries no keywords, so it is never auto-selected from a description; a unit record is created only by naming `--scope rin-unit` explicitly, with the parent line.

**Engine side effects.** The engine's own audit and memory writes into any record other than the unit's own are left unstaged. They are never part of a unit's diff.

## 7. Lean-scope walk

This scope drops Gates 0, 1 and 2, which later gates name in `requires_stage` and `consumes`. Both resolve benignly.

- **`requires_stage`:** the dropped gates' orphaned edges are vacuous at walk time. The forward walk (`nextInScopeStage`) never visits a SKIP stage, so those edges are never evaluated.
- **`consumes`:** the required consumes those gates produce (`rin-requirements`, and on the current Gate 3 also `rin-components`) are absent from a unit record and resolve `expected: true`, because no producer is on this scope's path. That is the designed lean-scope shortcut: the unit reads them from its parent through the parent line.

At Gate 4 the lead checks the parent's approved Gate-1 requirements on fetched `origin/main` against the approved component that names the unit and the unit's own approved Gate-3 lock before writing the implementation plan. A missing approval or relationship stops planning and routes the gap to the parent. The engine's `expected: true` consume alone does not establish this parent input.

Every artefact Gates 4, 5 and 6 consume from Gate 3 onward is produced on this path, so no run under this scope may produce `expected: false` on a legitimate path.
