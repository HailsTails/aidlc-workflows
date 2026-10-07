---
slug: rin-gate-0-reconcile
number: 2.10
name: Gate 0 — Reconcile
plugin: rin
phase: inception
execution: ALWAYS
condition: First gate of the rin pipeline. Promotes an eligible consumer intake capture into a native engine intent record, reconciles it and any prior spec residue against deterministic ground truth, then confirms it is ready to frame. Grooms; does not frame (Gate 1), does not choose a solution (Gate 2) and does not design one (Gate 3).
lead_agent: aidlc-delivery-agent
support_agents:
  - aidlc-product-agent
mode: inline
reviewer: aidlc-architecture-reviewer-agent
review_artifact: rin-reconcile-report
reviewer_max_iterations: 2
approval_mode: autonomous
produces:
  - rin-reconcile-report
  - rin-readiness-verdict
consumes: []
requires_stage: []
sensors:
  - required-sections
  - dd-1
  - dd-2
  - dd-7
scopes:
  - rin-gates
  - rin-harness
  - rin-audit
inputs: The target work — an eligible consumer intake capture to promote, or an existing engine intent record to reconcile — plus any prior spec/artifact residue for it
outputs: rin-reconcile-report.md (the coherence sweep + ground-truth verdicts + the promotion applied) and rin-readiness-verdict.md (Gate-0 PASS/HOLD), under this stage's record dir, engine-resolved
---

# Gate 0 — Reconcile (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual
(reviewer, learnings, approval, report) uniformly around this stage. This file
describes only the WORK: the intake promotion + coherence sweep + readiness
groom. It does NOT present the gate or report — that is the conductor's
control-plane job.

This is the pipeline's front door. Before framing hardens into requirements, Gate 0 **promotes** the target work into a native engine intent record (if it is not one already), reconciles it against **deterministic ground truth**, and confirms it is ready to enter framing. It grooms and reconciles; it does not frame (Gate 1), does not choose a solution (Gate 2) and does not design one (Gate 3).

Work this gate adopts — a prescription carried in a capture, an existing draft, an approach from an earlier PR — enters the record as one candidate for Gate 2's options ledger, never as the solution.

## The system of record this gate establishes (repo-SoR)

Promoted work has one authoritative workflow record. Stage, lifecycle, and
identity live in the engine's record dirs (`intents.json` + `aidlc-state.md` +
`<record>/audit/`). A consumer-configured intake integration may supply captures
from {{BACKLOG_STORE}}; promotion transfers lifecycle authority to the engine
once, without mirroring stage state back into another store. Intake categories
and capture closure follow the consumer's configured integration.

So Gate 0 owns exactly one lifecycle move for a fresh capture: **promote it into
the workflow record and disposition its intake entry.** Every later gate's state transition is the
engine's own `report --result approved` (Current Stage + a GATE_APPROVED audit
event, committed in-repo by construction) — not a DB call and not a receipt.

## Deterministic ground truth (read, never guess)

- **Engine state** — the intent's `aidlc-state.md` Current Stage is the authority
  for where it sits on the machine, not any prose. `intents.json` is the registry.
- **Record present** — does an engine record exist for this work? Is there prior
  spec/artifact residue that must be folded in or retired?
- **Git ground truth** — for any "already shipped / superseded" claim, git on the
  active branch is the authority (symbol present, or verified gone).
- **Intake queue** — the consumer-configured {{BACKLOG_STORE}} integration,
  read to find eligible unpromoted captures awaiting their one-way promotion.

Rule: **no reconcile-away on an unverified claim.** A body assertion is a lead;
the engine state, the record, and git are the verdict.

## Intake is transient — the reading is the product

An eligible capture is **transient intake** for the pipeline. Promotion creates
one workflow record; the consumer's integration disposes of the intake entry.
Workflow stage and scope then belong to that record, without a second lifecycle
or classification mirror in the intake store. Consumer operating knowledge owns
the intake category and closure policy.

So the whole of intake judgement lands in exactly three places:

1. **A disposition** — one of four moves the run makes (Step 1). Not a stored
   label; a thing the run *does* this run.
2. **The promotion framing** — the `--label` and `--arguments` prose handed to
   `rin-gates:promote`, which become the intent record's identity and its opening
   statement of the problem. This is where a good reading pays off and a lazy one
   does permanent damage: the record is durable, the row is not.
3. **The run digest / reconcile report** — what was promoted, batched, archived,
   or left, and why.

A heuristic that would require a new field is a defective heuristic. Re-derive it
as a judgement made from the capture text.

## The per-run contract (every run, forever)

Grooming intake is an **ongoing obligation**: keep captured work processable and
ensure new captures receive a disposition without disappearing into a backlog.

Three consequences, each load-bearing:

1. **Intake grooming never completes.** There is no finish line and no
   "post-drain" mode. The lane is a standing rhythm whose job is to keep the queue
   bounded, forever. A design sized against the standing backlog is mis-sized; the
   sizing input is **inflow**.
2. **"Processable" is the success criterion**, not "empty". Work must arrive in
   the AIDLC workflows in a shape the gates can carry — which is why promoting
   *less* and framing *better* is correct, and why an unbounded promotion pass is
   a failure mode rather than an achievement.
3. **"No new capture gets lost" must be MECHANICAL.** A never-ending backlog is
   precisely one whose old items are never revisited because every run works the
   top. That is structural, so it needs a structural alarm, not an intention to be
   thorough.

Every run — scheduled or ad-hoc, backlog-heavy or quiet week — satisfies the same
contract. A run that cannot satisfy it reports the failure loudly rather than
completing quietly.

> **CONTRACT.** measured queue IN → N dispositioned, each with its capture id,
> its disposition, and the heuristic that produced it → measured queue OUT.

1. **Measured queue IN.** Regenerate the status projection with a live
   `--tasks-snapshot` and record the intake-queue size *before* acting. A run that
   could not obtain a live snapshot records the queue as **UNMEASURED** and does
   not proceed to disposition work — it reports the instrument failure as its
   outcome. **UNMEASURED is never rendered as 0.** A structural zero read as a
   measurement can silently no-op this lane's promotion duty; the same discipline
   binds every count in this contract.
2. **Dispositioned, with citations.** Every capture the run *opens* receives
   exactly one of the four dispositions and cites the heuristic that produced it.
   Opened-count equals dispositioned-count, or the run states the gap explicitly.
3. **Measured queue OUT.** Regenerate after acting and record the resulting size,
   again UNMEASURED rather than 0.
4. **The drain arithmetic** is computed and reported — inflow since the previous
   run versus processed this run — so a growing backlog is visible immediately.
5. **The max-age alarm** is computed and, if firing, surfaced as a LANE FAILURE.

Clauses 3–5 are not trailing niceties. They are how "no new capture gets lost"
becomes structural rather than aspirational, and a run that skips them has not
satisfied the contract even if its promotions were all sound.

### Sizing: against inflow, not against the backlog

| Variable | Meaning |
|---|---|
| `INFLOW_WEEK` | new eligible intake captures per week, steady-state |
| `CADENCE` | scheduled Gate-0 intake runs per week |
| `INFLOW_PER_RUN` | `INFLOW_WEEK / CADENCE` |
| `BURN` | surplus cleared per run, above inflow, to draw the backlog down |
| `BATCH` | captures a run must disposition — `INFLOW_PER_RUN + BURN` |
| `BACKLOG` | measured queue size at run start |

```
BATCH = INFLOW_PER_RUN + BURN
  BURN ≥ 1  while BACKLOG > BACKLOG_CEILING   (elevated)
  BURN = 0  when BACKLOG ≤ BACKLOG_CEILING    (steady state, forever)
```

> **`BATCH ≥ INFLOW_PER_RUN` — always.** A run that dispositions fewer captures
> than arrived since the last run is a run during which the backlog GREW.

**Starting values, on the same terms as `MAX_AGE_DAYS`** — set here so a run can
evaluate its own predicate today, and re-set from measurement rather than left
undefined:

- **`BACKLOG_CEILING = 50`.** The queue is "bounded" when it holds no more than a
  few runs' worth of work, so the tail cannot age past the alarm before a run
  reaches it. At a 15–30 body-reading bite that is roughly two runs deep. Re-set it
  to `2 × BATCH` once `BATCH` is stable, which is the property actually wanted; 50
  is that expression at today's bite.
- **`BURN`: the run takes its full body-reading bite and `BURN` is whatever remains
  after inflow** — `BURN = BATCH − INFLOW_PER_RUN`, with `BATCH` set by attention
  (15–30), not chosen independently. `BURN` is therefore an *outcome* to report,
  not a dial to pick: a run does as much as it can read well, and the arithmetic
  says whether that cleared inflow. Naming a `BURN` target and then reading past
  attention to hit it is the failure this bound exists to prevent.

So the steady-state predicate a run evaluates is: `BACKLOG ≤ 50`. Above it, every
run is implicitly elevated-cadence; at or below, the same run is holding the line.

**Separate standing queue size from arrival rate.** Older captures may have
already been promoted or archived. A timestamp histogram of remaining captures
therefore cannot establish inflow; measure arrivals over a known interval.

Which is why **`INFLOW_WEEK` is re-measured each run** from the reported
arithmetic rather than fixed here: `INFLOW SINCE LAST RUN` counts captures created
in a known window, which *is* an arrival measurement and is not survivorship-biased.
That is what makes the lane self-correcting before any parameter is tuned — and it
is why no `INFLOW_WEEK` constant appears in this doc.

**The independent bound: body-reading budget.** Whatever inflow turns out to be, a
run's real constraint is reading attention, not tool calls — the framing lens and
the solution-shaped detector both degrade badly if rushed. A realistic bite:
screen the whole queue by title (cheap), open and disposition **15–30 bodies**,
mint **3–8 records** (fewer, because batching collapses siblings and
archive/leave consume captures without minting). If `INFLOW_PER_RUN` exceeds ~30
the constraint is `CADENCE`, not batch size: **more runs, never a bigger bite.** A
run that dispositions 60 bodies produces 60 bad readings, and under transient
intake a bad reading is irreversible.

**A run that cannot clear inflow is a LANE FAILURE**, surfaced as such — never
absorbed as a quiet shortfall. The never-ending-backlog mode is built out of
individually forgivable shortfalls, so the lane refuses the first rather than the
tenth. On a shortfall the run completes and reports everything it did disposition,
emits the deficit arithmetic, names the binding constraint from the closed list
(`body-reading budget` / `evidence unavailable` / `MCP unavailable` / `run
aborted`), and escalates on **three consecutive** shortfall runs — deliberately
mirroring the stuck-Slice three-run idiom so the pipeline has one escalation
grammar, not two.

### The max-age alarm — no capture left behind

> **ALARM.** Any active, unpromoted eligible capture older than
> **`MAX_AGE_DAYS`** is a **LANE FAILURE**, surfaced in the run report in the
> **same class as UNMEASURED**.

Same class as UNMEASURED is the load-bearing phrase. UNMEASURED exists because a
silent wrong reading let this lane no-op its duty for months while looking
healthy. An aged-out tail is the identical failure by another mechanism: the lane
looks productive every run — promotions happening, queue being worked — while a
cohort is structurally invisible. Both present as success, so both get the loud
treatment.

**Starting value `MAX_AGE_DAYS = 90`**, to be re-set from the measured
`capturedAt` distribution at the **95th percentile of steady-state
age-at-disposition**. Two-sided reasoning: it must exceed queue-cycle time at
planned cadence or it fires constantly during legitimate drain and trains into
noise; and it must sit under a quarter, because past that a premise has usually
moved — the dominant archive causes on this corpus are *shipped* and *moot
premise*, which are just age acting on a fast repo.

**Computed in `rin-gates-status.ts`**, beside the intake queue — derived state
over the timestamp already in the snapshot, inheriting the same
`measured | unmeasured` union (no snapshot ⇒ **UNMEASURED**, never "no alarm"),
and diffable between runs. A prose-computed alarm is one a rushed run forgets.

On fire, exactly three things: **surface it** as a LANE FAILURE line with cohort
count and oldest age; **reserve at least one third of the batch** for the aged
cohort, oldest first — without this the alarm reports forever while runs keep
working the top; and **continue normally** — it never blocks, aborts, or gates.
During elevated cadence it fires on the pre-existing old cohort by construction:
that is correct, must not be suppressed, and is reported as one cohort line rather
than N failures.

**Never:** swallowed because the run "knew about those already", downgraded
because it fires every run during the drain, or suppressed by filtering the old
cohort out of the queue. Each reintroduces the invisible-tail failure it exists to
prevent.

**When the reservation collides with inflow.** If the aged cohort persistently
takes a third of the batch while inflow alone nearly fills it, the run will clear
less than arrived and report `INFLOW CLEARED: NO`. That is **correct, not a
conflict**: it is genuine under-capacity, and the right response is the one the
lane already has — the shortfall surfaces, three consecutive runs escalate as a
lane-sizing question, and `CADENCE` rises. Do **not** resolve the collision by
shrinking the aged-cohort reservation; that trades a visible failure for an
invisible tail, which is the exact swap this section forbids.

### Required report lines (every run, fixed order)

Any count the run could not measure reads `UNMEASURED`, never `0`.

```
INTAKE QUEUE IN:       <n> | UNMEASURED
INFLOW SINCE LAST RUN: <n> | UNMEASURED   (captures created since <prior run ISO>)
DISPOSITIONED:         <n>  = promote-now <a> / batch <b> / archive <c> / leave <d>
RECORDS MINTED:        <n>  (<record dirs>)
INTAKE QUEUE OUT:      <n> | UNMEASURED
NET CHANGE:            <out - in>  (negative = backlog shrinking)
INFLOW CLEARED:        YES | NO — dispositioned <n> vs inflow <n>
MAX-AGE ALARM:         OK | LANE FAILURE: <n> older than <MAX_AGE_DAYS>d (oldest <n>d) | UNMEASURED
```

`a + b + c + d` must equal `DISPOSITIONED` — totality made arithmetic, so an
unowned capture becomes a visible inconsistency rather than an omission.
`INFLOW CLEARED: NO` carries the binding constraint; three consecutive escalate.
`NET CHANGE` positive across three consecutive runs is the growing-backlog signal
independent of per-run inflow, and escalates on the same rule. The lines are
fixed-order so consecutive reports **diff cleanly** across sessions with no memory
of each other — a trend is this lane's primary health signal, and a trend is only
readable if the shape is stable.

### Repeatability — every judgement cites its heuristic

> **A fresh scheduled session, with no memory of any prior run, must produce the
> same dispositions from the same queue.**

Each dispositioned capture is reported as
`<capture id> | <disposition> | <heuristic cited> | <reason>`, citing from the
closed set: a disposition entry condition, an origin shape, the solution-shaped
detector's outcome, the half-fixed sibling test, or the aged-cohort reservation.
This applies the repo's derivation rail to **process** — a disposition is a derived
assertion, and the heuristic is its derivation, so drift between runs is diffable
rather than invisible.

**Cite the lens; never store it.** An origin shape appears in the run report as
the reasoning for a framing. It is never written to the row, the record, or a
prefix — the moment you want to write the shape name down, you have misused it.

**A disposition that cannot cite a heuristic is a defect in this doc**, surfaced
as a gap for the next revision, never improvised into an ad-hoc rule.

### The standing backlog is this same run at elevated cadence

The standing backlog is **not a special one-off project**. It is this identical
run with `BURN > 0`, until the queue is bounded, after which the identical run
continues at `BURN = 0` forever. Only one parameter changes.

`runs to ceiling = (BACKLOG − BACKLOG_CEILING) / BURN`. At a realistic `BURN` of
10–25 that is roughly **15–30 runs — weeks, not a year**, and front-loaded because
archive-heavy early passes are the cheapest per item. Expected yield is **50–80
records, not one per capture**: archive-with-reason is the largest bucket on a
queue that accumulated while the promotion sweep was structurally broken, and the
promotable remainder batches roughly 2–3:1.

The failure mode to refuse: a run that promotes everything it reads converts an
unread backlog into an unframable pipeline — thin records with worse framing than
the captures they replaced, and under transient intake the capture text is gone.
**Promote less, frame better.**

**If a future reader finds a "post-drain" procedure anywhere in this lane, it is a
defect.** A special-cased drain would build a procedure discarded on completion,
leaving the steady-state lane unproven exactly when it takes over.

## Steps

### Step 1: Resolve the target work, and disposition every capture you read
The target is passed by the caller when there is one; otherwise SELECT it:

- **Fresh intake** — an eligible capture in the consumer's {{BACKLOG_STORE}} not yet
  promoted (no engine record carries its id as `promoted-from` provenance). List
  consumer-selected intake tasks (`list_tasks` where supported), take the oldest one genuinely ready to
  frame (genuine selection each run, never a pinned target). Captures carry no
  priority field, so oldest-first is the ordering — and it ranks by waiting time,
  not by how cheap the capture looks to promote.
- **Existing intent** — an engine record already in the pipeline whose Current
  Stage needs reconciling (below). Selected from the status projection, not the DB.

A run does not read a capture and leave it in an unnamed state. **Every capture
this run opens gets exactly one of four dispositions.** The set is closed — no
"other", no "unclear", no "skip". A capture you cannot yet act on gets
`leave-with-note`, which is a disposition with an obligation, not an absence of
one. This is the intake-side application of transition-ownership totality: an
unowned capture is a map bug, not an outcome.

#### (1) promote-now

**Entry — ALL of:** the capture states a problem this repo owns; the problem is
live against ground truth (git / PR / disk, not the body's say-so); it is framable
as one Slice without first answering a question only {{OPERATOR}} can answer; and
**no queued sibling AND no existing repo record shares its problem** (below).

**The no-sibling check spans BOTH corpora, and one null does not satisfy it.**
Checking only the queue is structurally blind: a promoted capture's row is
archived by construction, so every problem already framed as a record is invisible
to a DB probe. The check is therefore:

- the queue — **several short probes**, not one long one. `titleLike` averages
  per-token scores, so each added term dilutes the mean and a longer query is
  *strictly worse* at recall. Probe distinct
  single nouns and synonyms, and pass `status="all"` — the default is `"active"`,
  which cannot see an archived row.
- the record corpus — the registry and the records' `**Project**` fields.

**A null from one probe is not evidence of absence.** Either several varied probes
or one high-recall call is required before a no-home-found statement, and the
promotion **cites the probes it ran**. An uncited no-home-found claim is a defect,
not a promotion.

**Mechanics.** Frame the problem first (the lens below), then run the promotion
transaction in Step 1b. Writes the engine record, the provenance, the closed row,
and an **Applied this run** row: capture id → record dir, plus one line of framing
rationale — including, where the detector fired, that the capture was reframed
from a prescription and what the underlying symptom was judged to be.

#### (2) batch-with-siblings

**Entry — ALL of:** it would satisfy `promote-now`, AND at least one other queued
capture names the same underlying problem such that **fixing one and not the other
would leave the problem half-fixed**. Members are confirmed from bodies, never
from prefixes.

**Mechanics.** Choose an **anchor** — the member whose framing best states the
shared problem (usually the earliest well-framed one; a prescription-shaped member
is never the anchor). Promote the anchor with `--arguments` prose stating the
shared problem and enumerating every sibling id with its manifestation. Close each
non-anchor with `archive_task({ taskId: <sibling>, reason: "promoted-to-repo:<dirName> (batched with <anchor>)" })`.

Non-anchor siblings are **archived, not completed** — the work is not done, its
identity moved into the record. `complete_task` asserts doneness and is reserved
for the proven-shipped case.

A cluster exceeding what one Slice can honestly hold is not one Slice: promote the
anchor with the coherent subset and `leave-with-note` the remainder pointing at the
record, rather than minting a record no Gate 1 can frame.

#### (3) archive-with-reason

**Entry — ANY of:** **shipped** (proven from ground truth — a merged PR whose
subject matches by semantics *plus* a SHA, or a direct source read on the active
branch; a title naming a shipped predecessor is frequently a live follow-up, so
never bulk-close on a title); **moot premise** (framed against machinery that no
longer exists, proven not assumed); **duplicate** (another capture is the richer
canonical one — note an id8-collision group is a batch-capture artefact, **not** a
duplicate signal, so verify by content); **not a task** (a self-declared
observation, a note-to-self, an orphaned shell).

**Mechanics.** If live work remains inside an otherwise-dead capture, first
`capture_task` a clean successor (body linking the old id, reparented under the
right Epic), THEN archive the original citing the defect and the successor id.
Never stage-walkback, never direct-DB surgery — clean-new plus archive is the
pattern. Proven-shipped ⇒ `complete_task`; duplicate ⇒ retitle
`[DUPLICATE of <canonical-id>]` then `complete_task`; moot / not-a-task ⇒
`archive_task` with the reason.

**Writes the evidence** — the SHA, the PR number, or the path read. An archive row
without evidence is a defect; **"probably resolved" is never a reason.**

#### (4) leave-with-note

**Entry — ANY of:** **needs {{OPERATOR}}** (a framing fork, a values call, a constitution
amendment, or an irreversible non-DB action — note a *liveness/archival judgement*
on a capture is hers, a forward promotion is not); **unresolvable from this
surface** (needs a live check the run cannot make); **cluster remainder**; **run
budget reached** (read but not acted on).

**Mechanics.** No DB write at all. The row is transient intake, and an unactioned
read leaves no residue on it by design.

**Writes** a named line: capture id, one-line reason from the closed list, and —
where the note is `needs {{OPERATOR}}` — an actionable pack (why it is theirs, what changes
on each answer, everything pre-staged up to the one privileged action). **A bare
"needs {{OPERATOR}}" is itself a defect.**

#### Totality check before the run closes

Every capture opened this run appears exactly once across the four buckets.
Opened-count equals dispositioned-count, or the run states the gap explicitly.
Captures never opened are not a gap — they are the untouched queue, whose
remaining size the run reports from the regenerated projection, **or `UNMEASURED`
if it ran without a live snapshot — never as a zero.**

### Step 1a: Frame the problem before you promote

**The origin-shape lens (a reading lens, never a field).** What kind of event
caused someone to write the capture changes what a good framing looks like. Apply
it between reading the body and typing `--arguments`; never record it.

- **Detected failure** — something observed it going wrong. Promote with the
  evidence and the reproduction; the framing names the symptom and its cost.
- **Observed condition** — a standing state nobody has acted on. Framing states
  what is true now and why it matters, without inventing a detection event.
- **Intention** — a wish or goal. It has no detector; do not manufacture one.
  Framing states the desired outcome and the gap from today.
- **Obligation** — externally imposed (a dependency EOL, a policy). Framing names
  the imposer and the deadline, because those bound the solution space.
- **Decision-needed** — the capture asks a question rather than naming a defect.
  Often **not promotable as a Slice at all**: if the decision is {{OPERATOR}}'s, this is
  `leave-with-note` with an actionable pack, not a record minted to hold a
  question.

**The solution-shaped-capture detector (enforceable).**

> **The symptom test.** If you cannot name the symptom without reading the
> proposed fix, the capture was written as a solution.

Procedure, applied to the **body** — this is not a title regex:

1. Read the capture once.
2. Cover every imperative and every named mechanism.
3. From what remains, write: *"Today `<observable>` happens, and the cost is
   `<consequence>`."*
4. Judge: wrote it from the remaining text ⇒ negative. Only reachable by inferring
   backwards from the struck-out fix ⇒ positive. Could not write it at all ⇒
   positive, and harder.

**On a positive, the run reframes at promotion** — it does not propagate the
prescription. Recover the symptom from ground truth, order `--arguments` as
problem → evidence → the original prescription **explicitly demoted** to a
candidate, and take `--label` from the problem rather than the fix.

**If the symptom cannot be recovered, the disposition is `leave-with-note`, not
`promote-now`.** An invented problem statement is durable and looks authoritative,
which is worse than an unpromoted capture.

Why this matters beyond tidiness: naming the artefact that must change **is**
naming the solution, and it pins the fix before anyone has framed the problem.
Promotion then inherits a decision nobody made deliberately.

**On bracket prefixes.** Captures may carry prefixes such as `[harness]`,
`[meta]`, `[audit]`, `[feature]`, or `[research]`. Read them as **weak evidence
about the author's mood at capture time, never as classification** — the
vocabulary may not be closed or maintained, the prefixes are
not disjoint, and several are status or routing rather than category
(`[DONE pending merge]`, `[BLOCKER — {{OPERATOR}}]`). Legitimate: a tie-breaker when two
body readings are genuinely balanced, or a cheap *candidate* signal when assembling
a cluster (then confirmed from bodies). Illegitimate: treating `[audit]` as "this
belongs to the audit lane", or letting a prefix stand in for reading the body.
Where a prefix claims status, verify it against ground truth — several are stale.

### Step 1b: Promote the intake capture into a repo record (one-way)
If the target is a fresh eligible capture with no engine record, promote it with
the tool — never hand-mint:

```
pnpm rin-gates:promote --task-id <capture id> --label "<2-3 word essence>" \
  --scope <aidlc scope> \
  --importance <lane-flagged|not-flagged>:<milestone-id|no-milestone>:<T0|T1|T2|T3> \
  --arguments "<problem-framed prose — see Step 1a>"
```

Two legal tier-slot shapes, and only two:

- `…:no-milestone:<T0|T1|T2|T3>` — meta work. **A tier is MANDATORY**; `unscored`
  is banned here (below).
- `…:<milestone-id>:unscored` — milestone-bound work. FR-4 makes a ratified
  milestone and a scored tier mutually exclusive, so `unscored` is the *only*
  legal tier value on this shape and carries no laziness.

`--scope` is REQUIRED and is the classification decision this gate owns: it
selects the stage set the intent will walk. The tool refuses to guess it — a
silently-defaulted scope is an unmade classification, not a safe fallback, and
under transient intake it is the *only* organising decision that survives the row.

**Derive the scope; do not reach for `rin-gates`.** It is the full-gate scope.
The discriminating question is **which gates this record actually needs** — a record
whose next owed action is framing a design fork cannot take a scope that skips
Gate 1, and a record that needs none of them should not buy all of them.

`--importance` is REQUIRED on the same reasoning: a record minted with no
importance claim is a record whose importance nobody decided. The refusal is
against **silence, not low importance** — `not-flagged:no-milestone:T3` is a
valid, accepted, recorded decision.

**{{OPERATOR}} DEFINES the milestone set; choosing which member applies is THIS
LANE'S work.** Read the ranking policy selected by `RIN_GATES_SELECTION_CONFIG`,
or the shipped `selection-ranking.json` default (array order is rank order), and
consumer operating knowledge for milestone meanings. The consumer authors the
sets, the lane derives the binding, and the operator's per-record surface is the flag.

Three obligations follow, all checkable:

- **`no-milestone` is derived, never a shrug.** Per the ratified meta-work rule,
  pipeline / harness / gate / guard / CI / audit / code-health work binds it *by
  default and correctly* — but the reason is stated, not assumed.
- **`unscored` is BANNED on a `no-milestone` mint.** There is no "cannot assess"
  escape: an intent that fits no milestone still gets a **scored tier with
  evidence**, derived the same way the scope is. A meta record that cannot name a
  currency, an amount and evidence is **T3 by definition** — T3 *is* the answer
  when the claim is weak, not a fallback you avoid by writing `unscored`.
  Deriving T3 and saying why is a decision; `unscored` is the refusal to make one.

  The one place `unscored` remains legal is a **milestone-bound** record, where
  FR-4 makes a ratified milestone and a scored tier mutually exclusive — such a
  record carries the goal, not the budget that funds it.

  **The ban's population is LIVE records only.** A terminal
  record — `Status: Completed`, or scope `rin-retired` — is EXEMPT and stays
  unscored: a tier ranks pending work, and a record whose Gate 6 is done can
  never be selected. A sweep for `unscored` will find terminal records still
  carrying it; that is intended, not residue to clean up. Note the filter trap —
  `scope != rin-retired` alone is insufficient, because it admits
  `Status: Completed` records that were never retired.
- **Write `importance-derivation.md`. It is REQUIRED, not customary.** It carries
  the evidence chain — why this scope, why this milestone — plus a `## 5. Meta
  tier` section whenever the record binds `no-milestone`. A binding without its
  derivation is a finding at review.

**`operator-flagged` is REJECTED through this path.** The ranking flag is {{OPERATOR}}'s
alone: `lane-flagged` and `not-flagged` rank identically, so a lane can record
its honest read without jumping the queue, and {{OPERATOR}} flags a record afterwards
if it warrants one. A lane needs to jump the queue exactly once for the pipeline
to have chosen its own goals instead of {{OPERATOR}}'s.

Add `--dry-run` to see the plan without creating a record — note it refuses a
missing `--importance` too, so the requirement cannot be discovered only at
real-mint time.

This runs a single deterministic idempotent transaction:
1. **Create** the intent record via the engine's byte-pristine native path
   (`intent-birth` — mint + workspace scan + state-build), routing it to
   `rin-gate-0-reconcile`. The engine owns record creation; nothing hand-writes
   `aidlc-state.md` or `intents.json`.
2. Record the originating capture id as **dead provenance** (`promoted-from.json`)
   — a lineage reference nothing resolves, checks, or syncs.
3. The tool prints the exact **DB-row close call** for you to make as the
   transaction's second step (the DB is reachable only through the domain MCP
   boundary, which the tool cannot speak):

```
archive_task({ taskId: <capture id>, reason: "promoted-to-repo:<dirName>" })
```

Make that `archive_task` call. It is the ONLY half of the transaction the tool
cannot perform, so the tool prints it on every run — including a re-run that
found the record already promoted — and marks it OPEN. Until it lands the intake
row stays live and the capture keeps re-surfacing in later Gate-0 intake queues
as unpromoted-looking work.

Re-running the whole transaction is safe **on the success paths**: the create is a
provenance-guarded no-op and an already-archived row archives idempotently. It is
**not** unconditionally safe. If the tool reports `provenance write FAILED` — or
`manualRecoveryRequired: true` on the `--json` surface — do NOT re-run: the record
exists without its provenance, so the idempotency guard cannot see it and a re-run
mints a SECOND record for the same capture. Follow the recovery the error names.
That is the one disposition a scheduled lane must never blindly retry.

There is NO `slice-binding.json` — under repo-SoR the record dir IS the identity,
so there is nothing to bind.

(Migrating an EXISTING legacy record that has a bound dir but no engine state is
the per-intent migration's job, not this gate's fresh-intake path.)

### Step 2: Sweep for drift
Reconcile the engine state, the record dir, and any prior spec residue. Flag
drift. On a fresh single-intent run there is little to reconcile — record "no
drift" rather than manufacturing findings.

**Stage-lag reconcile class:** also handle an intent whose engine Current Stage is
BEHIND its gate-proven reality — its record dir's artefacts, an open/merged PR, or
a later gate's evidence prove it already sits past its recorded stage. Reconcile
the stage FORWARD to the gate-proven stage via the engine (`aidlc-orchestrate
next` / the engine's own advance), verifying the target stage against ground truth
first; never re-run the gate that already produced the later-stage evidence. This
is the reconcile gate's own in-band advance — fire it, do not escalate.

### Step 3: Write the two artefacts
- `rin-reconcile-report.md` — the coherence table (source | ground-truth |
  disposition | flags) and an **Applied this run** section, including any
  promotion performed (capture id → record dir, DB row closed) and any stage-lag
  reconcile.
- `rin-readiness-verdict.md` — **PASS** (coherent, ready to frame) or **HOLD**
  (name what blocks).

### Step 4: Commit, push, and open the PR — same run, never at the primary
Commit the two artefacts (and the promotion's `promoted-from.json`) on a WORKTREE
BRANCH, push, and open the PR the SAME RUN via `{{PR_COMMAND}}` (the affordance that
opens a pull request for the pushed branch under the author identity). Never commit at
the primary checkout — `guard-primary-commit` denies it deterministically. This
scheduled lane spawns into the primary checkout by default; move onto an agent
worktree before committing ({{WORKTREE_TOOL}}) — the session-start guide's
Worktree protocol carries the mechanics.

### Step 4a: Retire an obsolete-premise intent (HOLD's terminal disposition)
A HOLD whose premise has **evaporated** — every deliverable in the framing landed
by other means, so there is nothing left to build — is a TERMINAL verdict, not a
suspended one. Park is wrong (it means blocked-resume-later, and the intent keeps
re-selecting into every later Gate-0 pool). The engine offers exactly one terminal
vocabulary, `complete`, and the retirement's `--reason` string is the record of
why the Slice stopped — a retired Slice is one whose pipeline lifecycle is over,
not one whose deliverables shipped.

Retire with the wrapper, never by hand-sequencing the two mutations:

```
pnpm rin-gates:retire --record <record-dir-name> --reason "<why it is obsolete>"
```

It moves the record onto the `rin-retired` terminal scope (named in no stage's
`scopes:` list, so every stage resolves SKIP), reports finality so the engine's
own terminal-state assessment completes the workflow, and **reads the terminal
state back** before reporting success. A retired record drops out of the status
projection automatically, because the projection classifies only records whose
Current Stage is a gate slug.

Retirement stays **earned**: the transition travels the real approve path, so the
artefact guard (the stage's declared `produces:` must exist) and the reviewer
precondition both still fire. A Slice cannot be retired out of a gate it never
honestly reached.

**Who retires depends on WHY.** Apply the naming test before escalating: name
which reserved class the retirement falls in, or settle it yourself.

- **Obsolete-premise retirement — this gate fires it, autonomously.** The
  premise is refuted by ground truth (the locus is gone, the defect was fixed
  elsewhere, a later ruling absorbed it). That is a factual finding, not a
  values call. Cite the evidence, run `pnpm rin-gates:retire`, read the terminal
  state back, and record it in the digest. Do NOT escalate it — a dead record
  left queued re-selects into every later Gate-0 pool, and this exact escalation
  has already been filed four times against the same record.
- **Ratified-scope recut — escalate.** The premise stands and the question is
  whether the work is still wanted (reinstating an {{OPERATOR}}-retired Slice, dropping
  scope they commissioned). Reserved class 1. Escalate with the record, the
  evidence, and the pre-staged `--reason`, then proceed with the rest of the run.

The test: **premise refuted ⇒ retire; merely not-worth-doing ⇒ {{OPERATOR}}'s.** See
`{{HARNESS_DIR}}/scopes/rin-retired.md` § "Who retires" for the full split.

### Step 5: Resume a parked intent (never re-derive)
If the selected intent's committed `aidlc-state.md` carries the engine's
`Parked At Stage` marker (the never-strand PARKED protocol), this gate does NOT
re-run the parked gate's work from scratch. Route it back to the marked stage via
`aidlc-orchestrate next` (the engine's unpark-on-resume path) and continue from
there — the already-landed work is on `main` (the parked PR merged as class (d)),
so re-deriving it is waste and risks divergence.

### Step 6: Null-stage reservoir reconciliation (verify-then-act, never bulk)
As the intake resolver, Gate 0 owns the **null/missing-stage systems captures** in
the DB that no stage-selecting lane can see (the "not my job" reservoir). A missing
stage is itself an incompleteness to reconcile.

**These captures take the same four dispositions as every other capture** (Step 1)
— there is no second vocabulary. A null stage changes only *who else could have
handled it* (nobody), never what the moves are. What follows is the reservoir's
specific mechanics **inside** those dispositions. Each is VERIFY-THEN-ACT against
ground truth (a live `get_task` + git/PR/disk proof), never a title-alone guess.

- **Shipped → `archive-with-reason`.** Prove doneness (merged PR whose
  TITLE-subject matches by semantics + a git SHA, or a direct `git ls-tree` /
  source read on the active branch) BEFORE `complete_task`. A title naming a
  shipped predecessor is often a LIVE follow-up — never bulk-complete on a title.
- **Incorrect / dead state → `archive-with-reason`.** Superseded machinery, a moot
  premise resolved by a later change, an orphaned WorkItem, or a self-declared
  "not a task" observation. If live work remains inside it, `capture_task` a clean
  successor first (body linking the old id, reparented under the right Epic), THEN
  `archive_task` the original citing the defect + successor id. Never
  stage-walkback, never direct-DB surgery.
- **Duplicate → `archive-with-reason`.** Retitle the non-canonical
  `[DUPLICATE of <canonical-id>]` and `complete_task` it; keep the richer /
  Slice-typed canonical. An id8-collision group (shared UUID timestamp prefix) is
  a batch-capture, **NOT** a duplicate signal — verify by content.
- **Type / group → a pre-step, not a disposition.** A roleless null-stage root
  belonging under an existing Epic/Goal → `reparent_task`; a roleless capture that
  is unambiguously a pipeline node → `promote_task` to its role, then continue to
  `promote-now` per Step 1b. Where the body leaves the identity ambiguous the
  disposition is `leave-with-note`, not a guessed role. Do NOT over-formalise: a
  quick config decision is fine left as a roleless capture.

Reservoir work is **not spare-capacity grooming done alongside intake** — it is the
standing obligation itself, and its volume is bounded by the batch formula like any
other capture, not by whatever time is left over. Report it through the same
required lines; the digest names successor ids where any were minted. An incident
report whose resolution is not verifiable from this surface (auth-dead, corruption)
is `leave-with-note` flagged for a live check, never archived on a "probably
resolved" guess.

Stop here. Do not run a review, present a gate, or report — the conductor runs the
gate ritual (reviewer, learnings, approval) configured on this frontmatter.

## Refuses (invariants)

- **Verify before you reconcile-away.** Hard evidence or it is a proposal.
- **Promotion is one-way.** A promoted capture's DB row is CLOSED; the pipeline
  never writes the DB stage for a systems Slice again. The engine record is the
  sole state authority from here on.
- **No hand-minting.** The engine creates the record (`rin-gates:promote` →
  `intent-birth`); nothing hand-writes `aidlc-state.md`, `intents.json`, or the
  provenance file's role.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
