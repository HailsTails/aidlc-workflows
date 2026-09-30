---
slug: rin-gate-5-review-cycle
number: 3.20
name: Gate 5 — Review Cycle
plugin: rin
phase: construction
execution: ALWAYS
condition: Final gate of the rin pipeline — the reviewer↔author review round-trip, run as a bounded DECORRELATED cycle inside one stage. A decorrelated review board (the six pr-review hunts + disposition-diff enforcer + intent-defense synthesis) sweeps the PR; NOT-READY routes findings to the author leg (exhaustive disposition table); re-sweep up to the iteration cap. Converges to merged only on APPROVE + zero unresolved atoms + a managed merge ({{MERGE_COMMAND}} under the rails conditions; {{OPERATOR}} holds a standing veto).
lead_agent: aidlc-developer-agent
support_agents: []
mode: inline
approval_mode: autonomous
reviewer: rin-decorrelated-review-agent
review_artifact: rin-disposition-table
reviewer_max_iterations: 3
produces:
  - rin-disposition-table
consumes:
  - artifact: rin-code-generation-plan
    required: true
  - artifact: rin-code-summary
    required: false
requires_stage:
  - rin-gate-4-implement
sensors:
  - required-sections
  - dd-1
  - dd-2
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
scopes:
  - rin-gates
  - rin-harness
  - rin-audit
  - rin-ops
  - rin-dep-bump
  - rin-bugfix
  - rin-unit
inputs: The Gate-4 implementation (the PR), its rin-code-generation-plan, and Gate 4's committed `report --result approved` audit event (review-entry gate)
outputs: rin-disposition-table.md (the closed-contract disposition of every feedback atom) + this gate's own committed `report --result approved` audit event (recorded only when the round-trip converges), under this stage's record dir, engine-resolved
---

# Gate 5 — Review Cycle (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual around
this stage, but the reviewer step here is the DECORRELATED sweep of
`decorrelated-review.md`, NOT a single reviewer, and the review↔fix loop is the
§12a bounded iteration. This file describes only the WORK: the decorrelated review
board, the author disposition leg, the convergence predicate, and the one DB
transition this gate owns. It does NOT present the gate or report.

This is rin Gate 5+6 folded into one stage — the `pr-review` (reviewer session)
and `pr-feedback` (author session) skills, expressed as a single AIDLC stage whose
INTERNAL ritual is the review round-trip. It is Option A: the round-trip is a
bounded cycle INSIDE the stage, never a DAG back-edge and never a DB
backward-advance.

## Why a cycle can live inside a stage (the two invariants it honours)

- **The AIDLC DAG is acyclic** (a `requires_stage` dependency must be
  lower-numbered — compile invariant). So there is NO `rin-gate-5 → rin-gate-5`
  edge. The loop is the §12a reviewer-iteration loop *inside* this one stage,
  capped by `reviewer_max_iterations` (3 here).
- **The engine's own stage record is forward-only** (`merged` is a terminal
  Current Stage; a backward move is exactly the `kind:"validation"` rejection
  the engine keys on). So a REQUEST_CHANGES does NOT move the recorded stage
  backward. The Slice's Current Stage stays at `implemented` for the whole
  cycle; only convergence records it as `merged` via the engine's own
  `report --result approved`.

## The cycle runs as DECORRELATED agents (not one reviewer)

The review leg is the decorrelated multi-lens sweep of
`{{HARNESS_DIR}}/knowledge/rin-gates/decorrelated-review.md`, driven off a
**Gate-5-specific board**: `{{HARNESS_DIR}}/knowledge/rin-gates/rin-pr-review-board.json`. The
`reviewer: rin-decorrelated-review-agent` frontmatter is the coordinator
marker: the conductor runs the named protocol inline after the normal reviewer
request, then writes the standard review file from the board. This stage
names the pr-review board in place of the constitution board (the constitution
sweep is Gate 3's job — a PR review ASSUMES the automation + gates 1–4 already
ran, and hunts only what none of them can see).

The board's producing lenses are the six `pr-review` hunts, each a read-only agent
(`tools: Read, Grep, Glob`, `disallowedTools: Task`) — so **reviewer ≠ author is
structural**, exactly as the constitution board guarantees:

1. `rin-pr-checkers-reviewer-agent` — did this PR weaken / carve out / reconfigure any gate, check, or audit scope?
2. `rin-pr-evades-reviewer-agent` — letter-passes-spirit-fails (suppressions, cast-shaped things, discipline tripwires in new shapes).
3. `rin-pr-claims-reviewer-agent` — every "{{OPERATOR}} approved / gate passed / spike confirmed" claim verified against the actual record; scope vs the latest recorded decision.
4. `rin-pr-scope-reviewer-agent` — instance quality never launders a scope/architecture verdict; shared-contract defect patched per-app is blocking; latent exposure is exposure.
5. `rin-pr-tests-dead-reviewer-agent` — symmetric fakes, unwired bindings, silent defaults, boot-order landmines that green suites structurally cannot catch.
6. `rin-pr-disposition-reviewer-agent` — (re-review rounds) diff the author's disposition table against a fresh atom enumeration; ANY unresolved row / missing row / un-acked defer ⇒ NOT-READY independent of whether blocking findings were fixed.

The synthesis lens runs LAST: `rin-intent-defense-reviewer-agent` re-tests the
collated PASS claims against rule INTENT (the decorrelation guarantee no script
catches). Verdict = READY iff every producing lens is READY AND intent-defense
finds zero surviving gaps AND the disposition gap is zero.

## The author leg (the NOT-READY route)

On NOT-READY, the conductor routes the cited findings to the LEAD agent (the
author role, `{{AUTHOR_IDENTITY}}` in the live world) — never to a review lens (they cannot
mutate; `disallowedTools: Task`). The author works the **exhaustive disposition
contract** (`pr-feedback`): every atom gets exactly one closed disposition —
`fixed@<sha>` / `push-back(<ground>)` / `defer(ack:<ref>)`, zero unresolved. A
{{OPERATOR}} comment is a non-droppable atom closed only by `fixed` or an {{OPERATOR}}-acked
push-back. The disposition table is this stage's `rin-disposition-table` artefact
and the machine-diffable convergence predicate. Then re-run the decorrelated sweep.

**The fix-leg writes code, so the deterministic teeth fire here too.** A `fixed`
disposition is a code change, and a review round is exactly where discipline
silently degrades (a quick fix that reaches for a cast, a suppression, a naive
default under time pressure). So Gate 5 carries the SAME CD sensor set as Gate 4
(`cd-1`/`cd-2`/`cd-6`/`cd-8`/`cd-14`/`cd-15`/`cd-17`/`cd-19`/`cd-23`/`cd-25`/`cd-26`/
`cd-27`/`cd-43`/`cd-44` + `carve-out-decay` + linter + type-check) — they fire on
every fix-leg write via the PostToolUse sensor-fire hook. A fix that clears a
review finding by introducing a CD violation is not a fix; the sensors keep the
round-trip from trading a review defect for a discipline defect.

## The state transition this gate owns (convergence only)

rin is repo-SoR: the rin repo — the engine's Current Stage in
`aidlc-state.md`, `intents.json`, and the committed audit trail — is the sole
system of record for this transition. There is no DB call and nothing to
write outside the repo. The Slice's Current Stage sits at `implemented`
throughout the cycle. On CONVERGENCE — every producing lens READY,
intent-defense clean, disposition gap zero, AND the merge itself — the
transition to `merged` IS the merge plus the engine's own
`report --result approved` (a GATE_APPROVED / STAGE_COMPLETED audit event,
committed in-repo). That commit is both the transition and its proof — no
DB call, no receipt, nothing further to write. A REQUEST_CHANGES round
records no such event, so the absence of a committed `merged` STAGE_COMPLETED
event IS the "still in review" signal.

**Two complementary merge paths (project-rails):** the FAST path is the
run-to-merged pipeline (`gate-run-1-pipeline-lane`) — this stage runs IN THE SAME
run that produced the Slice's PR (Gate 4 → hands straight to Gate 5), review +
merge in-run. The standalone scheduled Gate-5 sweep is the **standing resolver**:
it merges EVERY converged PR that a fast-path run did not itself carry to `merged`
— routinely, not as an exceptional backstop — including PARKED landings (class
(d)), strays, {{OPERATOR}}-veto returns, and orphan governance PRs. Both fire on
schedule; together they are the "complete runs AND mid-flight resolvers" shape.
The merge conditions below are identical in either path.

**The merge is this lane's action, managed cautiously — not {{OPERATOR}}'s bottleneck.**
On convergence, merge via `{{MERGE_COMMAND}} -- --pr <N>` — the affordance that squash-merges
the named PR under the author identity and itself refuses unless the PR's latest review
verdict is APPROVED. The
lane may invoke it ONLY when ALL of the merge conditions hold (the project-rails
"managed merge" rule): latest review verdict is {{REVIEWER_IDENTITY}} APPROVE, CI green,
mergeable CLEAN, no human comment or commit newer than that verdict, and no open
hold. Any condition failing → do not merge, flag the exact failing condition in
the digest. {{OPERATOR}}'s veto is standing: any comment from them newer than the verdict
puts the PR back in review scope instead of the merge queue.

**Sequence the branch BEFORE convening the review — every push after a verdict costs
a round.** A review verdict is pinned to a sha: a later push dismisses the APPROVE
(so `{{MERGE_COMMAND}}` refuses on "latest review verdict is absent"), and the engine's
own receipt is artefact-fingerprinted, so editing a `produces[]` artefact after
recording it re-opens the gate's refusal. Both are the bindings working, not
obstacles — satisfy them by re-reviewing current source, never by the documented
bypass flag. So land the gate artefacts, the ensemble contribution, and the
`origin/main` merge-forward FIRST, then convene. Review *corrections* are an
unavoidable second round; a merge-forward and a contribution file are schedulable
ahead of it. Note the tail case: artefacts that can only be written after the merge
(a post-merge ensemble, the terminal gate approval) need their own record-only
follow-up PR, branched from merged main — never a rebase of the squashed branch.

> Proposed (decision deferred to {{OPERATOR}}, NOT wired): add an `in-review` Current
> Stage so `implemented → in-review → merged` names where the round-trip
> lives, instead of the engine's stage record staying coarse at `implemented`.
> Kept zero-change for now — the committed `merged` audit event + the
> disposition table carry the review-round granularity. Flagged, not
> implemented.

## PARK, never strand (the invocation)

A run that CANNOT complete this gate this run (blocked: red CI that is not this
Slice's to fix, an MCP outage, an external dependency, a timebox hit, a diverged
worktree) PARKS — it does not end with work uncommitted. rin uses the
**engine-native park**, never a parallel rin park mechanism:

1. Call the engine's own park — `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts park` — which
   writes `Parked` + `Parked At Stage` into the intent's `aidlc-state.md` (a
   TRACKED, committable file) and makes the next `aidlc-orchestrate next` emit the
   terminal `parked` directive.
2. Commit ALL work-in-progress — including the `Parked At Stage` marker in
   `aidlc-state.md` — on the worktree branch, push, and open/update the PR. The
   rin-only seam is DURABLE PUSH: the resume marker survives the worker's death so
   a DIFFERENT worker resumes from the landed base. Nothing local-only, ever.
3. End the run. The resolver merges the parked landing as a class-(d) PR (no stage
   advance). The PR body carries the blocked reason + resume note — the engine's
   `Parked At Stage` carries the WHERE; the PR body carries the WHY and the next
   action.

A Slice re-parked at the SAME gate for the SAME reason across 3 consecutive runs
escalates to {{OPERATOR}} in the digest as a stuck-Slice — parking is a continuity
mechanism, not a way to churn a genuinely-blocked Slice forever.

## Steps

### Step 1: Select and classify the PR sweep (read-only)
The lane sweeps ALL open {{AUTHOR_IDENTITY}} PRs each run, not only PRs bound to an
`implemented` Slice (the project-rails "MANAGED autonomous merge" rule). This
sweep is the standing RESOLVER, not an exceptional backstop: it owns the
`merged` transition for every converged PR no fast-path run merged first, so
"not my lane" on a converged PR is a map bug, never an outcome. Classify each
into exactly one of four closed classes before doing any review work: **(a)
Feature** (bound to a Slice at `implemented`), **(b) Artefact-only** (every
changed file under `aidlc/spaces/*/intents/` or `docs/` — any
governance-surface file reclassifies to (c); the status projection pair is
gitignored derived state and never appears in a PR), **(c) Unbound
code/governance** (neither of the above), or **(d) PARKED** (the diff carries
the engine's `Parked At Stage` marker in the Slice's committed
`aidlc-state.md` — an explicit work-in-progress landing from a blocked run;
merged for shape with NO stage advance). The class determines the rest of
this stage's steps for that PR; the rail carries the full closed-class
definition and merge conditions, not restated here.

### Step 2: Prepare the PR head worktree, then harvest (read-only)
**First**, put the review ON the PR head:

```
pnpm rin-gates:review-worktree --pr <N>
```

This prepares a worktree checked out at the PR's current head and prints its
path, the head sha, the base ref, and the changed-file list. Record all four —
they are the board's input and its binding token.

The `rin-pr-*` lenses are `Read, Grep, Glob`: no Bash, no `gh`. They cannot fetch
or check out anything, so they review whatever tree they are launched in. This
stage's own session is required to sit on `main` (the sweep syncs `--ff-only
origin/main`), so a lens dispatched WITHOUT a pinned cwd reads already-merged
code as though it were the diff, producing confident, precise, **factually
inverted** findings. Preparing the worktree removes that failure
structurally — reading the tree then IS reading the PR.

Then enumerate the review surface from that worktree: the PR diff, the
rin-code-generation-plan, and (on re-review) any existing disposition table.

### Step 3: Reviewer leg — fan out the board IN PARALLEL (subagent, {{REVIEWER_IDENTITY}})
The reviewer leg consists of lens subagents distinct from the conductor and
from any author leg — decorrelation is identity + context separation, not time
separation, so both legs run inside this one stage cycle.

**Bind every lens to the Step-2 PR-head worktree** using its absolute path. Set
the dispatch working directory when the harness supports it; on Codex pass the
absolute path and require that every filesystem tool call uses it as `workdir`.
Pass the head sha + changed-file list in each prompt. Do NOT let a lens read a
fresh worktree or the conductor's tree — those are `main`, not the PR. Each lens
must echo the head sha in its verdict; a verdict that does not carry it, or
carries a different one, did not review this PR — discard it and re-dispatch
rather than collating it.

Per decorrelated-review.md §2: one subagent per
producing lens from `rin-pr-review-board.json`, concurrently where the harness permits, each blind
to the others. Collate PASS/VIOLATION. Then run
`rin-intent-defense-reviewer-agent` LAST over the collated PASS claims. For a
class-(b) PR (Step 1), the board runs the artefact-shape review named by the
rail (diff-confinement, no forged pipeline state, bindings well-formed,
claims-vs-record) in place of the full constitution-era hunts. The verdict
posts for real via `{{REVIEW_COMMAND}}` — the affordance that posts a real
APPROVE / REQUEST_CHANGES verdict on the named PR under the reviewer identity,
distinct from the author identity so a bot never reviews its own PR. The reviewer leg never
fixes anything.

### Step 4: Verdict + bounded iteration (conductor arbitrates)
READY (converge) or NOT-READY. The conductor only routes and arbitrates — it
never reviews and never implements. **A NOT-READY / CHANGES_REQUESTED verdict
does NOT end the run** — it is the entry to Step 5, worked IN THIS RUN. Posting
the verdict and stopping "for the author to pick up later" strands the PR: there
is no separate author lane, and reviewer≠author is satisfied by the Step-5
subagent (agent separation), never by deferring to a future session. On
NOT-READY within the iteration cap: route findings to the author leg (Step 5),
then return to Step 3 with a FRESH reviewer subagent over the new head — never
reuse a subagent across legs or rounds. On cap exhaustion (or a timebox hit
mid-cycle): PARK the Slice (the never-strand protocol below), never a bare HOLD;
escalate a genuine scope residue to the human at the gate as a scope decision
(never a raw option-vs-option question). For a class-(c) PR with no APPROVE on
the current head or no cited task id, there is no cap to exhaust — hold and name
the missing element in the digest (Step 6).

### Step 5: Author disposition leg (on NOT-READY; subagent, {{AUTHOR_IDENTITY}})
A separate author subagent ({{AUTHOR_IDENTITY}} identity, working from the PR-branch
worktree via {{WORKTREE_TOOL}})
works every atom to a closed disposition per the pr-feedback contract; writes/updates `rin-disposition-table.md`
(atoms total = fixed + push-back + defer(acked), unresolved = 0), pushes the
branch, posts the table. Push-backs need a constitution/contract ground; defers
need {{OPERATOR}}'s ack. The author leg never posts verdicts.

### Step 6: Merge and record the transition per class (convergence only)
On convergence, merge via `{{MERGE_COMMAND}}` under the managed-merge conditions
(rails rule; the affordance squash-merges under the author identity and refuses
without an APPROVED verdict), read the merge back
(`gh pr view --json state,mergedAt`), then record the transition per the PR's
Step-1 class — the rin repo is the sole system of record, so "recording the
transition" is always the engine's own `report --result approved`
(a committed audit event), never a DB call: class (a) records `merged` for
its bound Slice via the engine's `report --result approved` — the merge plus
that committed event IS the transition, nothing further to write; class (b)
records **no** transition — the stage was already recorded as complete when
the artefacts were produced, and this PR is only the record landing; class
(c) has no Slice and no transition to make; class (d) PARKED records **no**
transition — a parked Slice did not complete its gate, so there is no forward
move; the engine's `Parked At Stage` marker it carries, not a stage change, is
what a resuming run reads. Any PR that failed its class's merge conditions
(Step 4) gets no merge and no transition — flag the exact failing condition in
the run digest instead.

Reap the PR-head review worktree once the board has converged and the merge is
read back: `pnpm rin-gates:review-worktree --pr <N> --remove`. Leaving them
accumulates checkouts that slow every later search.

Stop here — the conductor runs the gate ritual (the decorrelated sweep IS the
reviewer step), learnings, and approval.

## Refuses (invariants)

- **Every lens runs pinned to the PR-head worktree.** Prepared in Step 2 via
  `pnpm rin-gates:review-worktree --pr <N>`; each lens is dispatched with its
  reads only from that absolute path and echoes the head sha in its verdict. A lens left on
  the conductor's tree or a fresh worktree reviewed `main`, not the PR; so did
  any lens whose echoed sha does not match. Those verdicts are discarded, never
  collated. A board whose verdicts cannot be bound to the PR head is a forged
  gate.
- **Decorrelated, never a single reviewer.** The review is the board fan-out +
  intent-defense synthesis; no omnibus reviewer.
- **Reviewer ≠ author, structurally.** Lenses are read-only (`disallowedTools:
  Task`); fixes are the author leg's. Never the same agent, never a subagent
  reused across roles or rounds, and the conductor itself neither reviews nor
  fixes — it arbitrates.
- **No silent drop.** Every feedback atom (including every {{OPERATOR}} comment, every
  non-blocking finding) gets exactly one closed disposition. An unresolved row ⇒
  NOT-READY, independent of whether blocking findings were fixed.
- **No merged without convergence.** `merged` requires READY + zero disposition
  gap + a managed merge under the rails conditions, recorded only by the
  engine's own committed `report --result approved`. A REQUEST_CHANGES round
  records nothing, and any failing merge condition holds the queue — flagged,
  never forced.
- **No backward stage move, no DAG back-edge.** The cycle is intra-stage; the
  engine's recorded Current Stage stays `implemented` until convergence.
- **A verdict is not an exit.** A NOT-READY / CHANGES_REQUESTED verdict is worked
  through the author leg IN THIS RUN (Step 5 → re-review), not posted-and-deferred
  to a future "author session" — no such lane exists, so a deferred verdict
  strands the PR. The only run-terminal outcomes are converge-and-merge, PARK
  (cannot complete this run), or a genuine scope escalation at cap exhaustion.
- **Never strand.** A blocked run PARKS via the engine-native park and pushes the
  marker durably; it never ends with work-in-progress uncommitted.

## Learn

While running this stage, maintain a running log in
`<record>/<phase>/<stage>/memory.md` (create on stage start if absent).
Append entries under: Interpretations, Deviations, Tradeoffs, Open questions —
each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the
harness, not into this file.
