---
name: rin-retired
plugin: rin
depth: Standard
keywords:
  - retire intent
  - retired slice
  - obsolete premise
  - abandon slice
  - terminal disposition
description: Terminal scope — a Slice whose premise evaporated leaves the pipeline here
---

# rin-retired scope

The terminal scope. A Slice moved onto `rin-retired` has **no stage left to
run**, so the engine's own finality assessment resolves it to `Completed` on
the next `report --result approved`.

## Why a scope, and not a new engine verb

The compiled `scope-grid.json` is a pure transpose of each stage's `scopes:`
frontmatter list. This scope is named in no stage's `scopes:` list, so every
gate transposes to SKIP under it. Nothing is authored here to keep in sync with
the gate set: a gate added tomorrow is skipped under `rin-retired` by
construction.

The compiled grid reads `3 / 10` EXECUTE, not `0 / 10`. The three are the
bootstrap initialization stages (`workspace-scaffold`, `workspace-detection`,
`state-init`), which the compiler treats as unconditional. All seven gates —
the only stages a live record can sit on — are SKIP.

Finality therefore rests on **two** conditions, both stated so neither is
assumed:

1. `nextInScopeStage` walks strictly FORWARD from the current stage
   (`aidlc-lib.ts:4726-4729`), and the three init stages are graph positions
   0–2 — behind every gate. The forward walk cannot reach them.
2. `scope-change` stamps the new grid into the state file as EXECUTE/SKIP
   suffixes, and those state overrides beat the grid. So an init stage left
   `pending` in state would be a live EXECUTE ahead of nothing — reachable only
   if a record were retired mid-initialization, before it ever reached a gate.

Neither case arises for a record old enough to retire: the earliest Current
Stage across the real record set is far past position 2, and a record that has
not reached a gate has nothing to retire. If it ever did arise, the wrapper's
terminal read-back catches it and refuses rather than reporting a false
retirement.

The consequence worth stating plainly: **one terminal scope is terminal at
whatever gate the cursor currently sits on.** A Slice retired at Gate 0 and a
Slice retired at Gate 4 both use this scope; there is no per-gate variant.

## What retirement asserts

`complete` is the engine's only terminal vocabulary, and it is the honest one
here — the `--reason` string and the `WORKFLOW_COMPLETED` audit row are the
record of *why* the Slice stopped. A retired Slice is one whose pipeline
lifecycle is over, not one whose deliverables shipped. The reason string
carries that distinction and is mandatory on the retire path.

## Retirement is earned, not asserted

The finality report anchors on the record's **last completed stage**, never the
mid-flight one. A stage checkbox reaches `[x]` only by passing
`verifyStageArtifacts` and `verifyReviewerPrecondition` when it honestly
completed, and the engine's `complete-workflow` skips both guards for an
already-`[x]` slug precisely because they already ran. The mid-flight gate's
checkbox stays `[-]` in the committed record — an honest "never finished" —
while the `--reason` string carries why. A record with zero completed stages
has nothing to anchor on and the wrapper refuses it.

Anchoring on the mid-flight stage was the tool's original shape and it could
not work: a Slice being retired mid-gate by definition never produced that
gate's artifacts or review, so `approve`'s guards refused every such
retirement. The guards
are correct; the anchor is where the honesty lives.

## Use

Never hand-sequence the two mutations. `pnpm rin-gates:retire` makes the
scope change and the finality report atomic, and reads the terminal state back
before reporting success:

```
pnpm rin-gates:retire --record <record-dir-name> --reason "<why it is obsolete>"
```

## Who retires

Retirement splits into two classes, and only one of them is {{OPERATOR}}'s. Apply the
naming test from `project.md` § "a fork is one of those reserved classes":
before escalating, name which reserved class the retirement falls in. If you
cannot name one, it is a problem the lane settles itself.

**Obsolete-premise retirement — the lane's, fired autonomously.** The Slice's
founding premise is refuted by ground truth: the locus it names is gone, the
defect it describes was fixed elsewhere, the mechanism it assumes was retired,
or a later ruling absorbed it. This is a **factual finding**, not a judgement
about whether work is worth doing — the work is already moot, and the evidence
is re-runnable. Cite the evidence, fire `pnpm rin-gates:retire`, read the
terminal state back, and record it in the digest. {{OPERATOR}}'s veto is standing and
cheap; that is what makes acting first correct. A lane that escalates an
obsolete-premise retirement has escalated a problem, which stalls the queue and
leaves a dead record re-selecting into every later pool.

**Ratified-scope recut — {{OPERATOR}}'s, escalated.** The premise still stands and the
question is whether the work is still *wanted*: reinstating a Slice {{OPERATOR}}
retired, retiring a Slice they explicitly commissioned, or dropping ratified
scope that no evidence has refuted. That is reserved class 1 (a ratified-scope
recut) or a values call. Escalate with a full actionable pack — the record, the
evidence, and the pre-staged `--reason` — and proceed with everything else.

The distinguishing question is **"has the premise been refuted, or do I merely
judge the work not worth doing?"** Refuted ⇒ retire. Not-worth-doing ⇒ {{OPERATOR}}'s.
"Retirement asserts work should never be built" describes only the second class;
read as a blanket reservation it produced four consecutive escalations of the
same obsolete-premise finding while the dead record kept re-selecting.
