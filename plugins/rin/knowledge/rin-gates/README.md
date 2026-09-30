# rin-gates — a gated delivery pipeline as an AIDLC stage graph

**New here? Read [ADOPTING.md](ADOPTING.md) first** — it lists the nine values you must configure and where your own rules, decisions, and history go. This plugin ships no facts about any particular project; those are yours to supply.

This plugin expresses a gated delivery pipeline in AIDLC's stage CONCEPTS: stages with `requires_stage` ordering, the approval gate, sensors, conductor-as-arbiter, and gate-completion side-effects. The stages ARE the pipeline's gates rather than AIDLC's shipped Ideation/Construction stages.

The engine stays byte-pristine — authoring a custom stage graph is a config and data extension, never a fork.

## The custom graph

Seven gate stages, chained by `requires_stage`, selected by the `rin-gates` scope:

```
Gate 0 reconcile → Gate 1 framing → Gate 2 solution options → Gate 3 detailed solution design → Gate 4 implement → Gate 5 review-cycle → Gate 6 operate
```

Gate 2's slug stays `rin-gate-2-plan-review` and Gate 3's stays `rin-gate-3-interface-lock`: slugs key the scope grid, the ownership map, the rosters and every record's Current Stage, so the redefinition changed the stages' content and display names only.

Each arrow is a `report --result approved` on the engine's own Current Stage —
there is no separate DB stage label to track alongside it (repo-SoR).

Gate 5 is the reviewer↔author review round-trip (the `pr-review` + `pr-feedback`
skills) folded into ONE stage whose internal ritual is a bounded DECORRELATED
cycle — see "Gate 5" below. Gate 4 STOPS at `implemented`; the `implemented →
merged` transition belongs to Gate 5, after review converges. Gate 6 is the
operational gate (deploy, monitor, bookkeeping) — genuinely missing from the
original rin gates, which stop at merge; see "Gate 6" below.

Rin's gate stages compose into the consumer's graph. Their installed bodies live at
`{{HARNESS_DIR}}/aidlc-common/stages/{inception,construction,operation}/rin-gate-*.md`
and compile into `{{HARNESS_DIR}}/tools/data/stage-graph.json`. The consumer
selects the `rin-gates` scope in its own harness configuration.
Gates 0–3 are `inception` phase
(numbers 2.1–2.4); Gates 4–5 are `construction` (3.1–3.2); Gate 6 is `operation`
(4.1) — the `requires_stage` lower-numbered-dependency compile invariant holds
naturally.

Each gate is `mode: agent-team` (Gates 1–4 convene the matching rin team;
Gate 0 is a lead-arbitrated groom) with a declared `reviewer`, so the conductor
runs the gate ritual (reviewer, learnings, approval, report) uniformly. The stage
`.md` bodies describe only the WORK; they never present the gate.

## Gate artefacts: native AIDLC, one substrate

Each gate authors its own namespaced artefacts, and each folds the content of one or more native AIDLC stages into itself rather than running them as separate stages. The right-hand column states a fold: the rin artefacts carry that native stage's content, they are not artefacts the native stage itself produces.

| rin gate | rin artefacts | native AIDLC content it folds |
|---|---|---|
| Gate 1 framing | `rin-requirements`, `rin-framing-questions` | requirements-analysis: the requirements and their acceptance criteria |
| Gate 2 solution options | `rin-solution-options`, `rin-options-questions` | domain-design's options comparison: genuinely different candidates per decision point, the comparison on the rows that separate them, and the decision recorded inline with a reason for every rejected candidate |
| Gate 3 detailed solution design | `rin-components`, `rin-interface-lock` | domain-design's domain model and components; units-generation's units and their dependencies; contract-design's contracts, with versioning and ownership policy |
| Gate 4 implement | `rin-code-generation-plan`, `rin-code-summary` | code-generation: the plan and its summary |

Do not layer a second spec→plan→tasks substrate over this chain. Two substrates for
the same progression means running two engines and syncing them; one substrate makes
the AIDLC record dir the single source. A separate gate-lock marker file is likewise
redundant — the native ordered walk + approval gate, reinforced by the committed
Current Stage + audit event that `report --result approved` produces, already carries
the lock (below).

## Ownership partition: repo-SoR (no sync surface)

The **consumer workspace is the sole system of record** for pipeline work. Stage, lifecycle, and
identity live only in the engine's own record: `intents.json` (registry), each
intent's `aidlc-state.md` (Current Stage), and its `<record>/audit/` shard (the
gate-completion audit events).

- **The AIDLC workspace record dir owns BOTH state and detail**: requirements,
  design, interface bundle, implementation plan, logs, AND the Current Stage +
  audit trail that prove a gate completed.
- **The configured backlog store is an intake buffer only.** A capture is
  promoted to a workspace record once at Gate 0 (`rin-gates:promote` →
  `intent-birth`, recording `promoted-from.json` provenance). The source capture
  is then closed through its configured adapter. There is no continuous stage
  mirror back to the intake store.

Nothing is held twice, so there is no sync surface. Each gate does one thing: it
produces its AIDLC detail artefact and completes the engine's own stage
transition — no second authority to bind, sync, or reconcile against.

## State authority (repo-SoR): the engine record IS the proof

The gate-completion side-effect is the engine's own transition — not a receipt
attesting to a change made elsewhere. No backlog-store involvement past
Gate 0's one-way promotion:

1. **The conductor calls `report --result approved`** (`aidlc-orchestrate.ts`)
   at each gate. This IS the transition: it advances the intent's Current Stage
   in `aidlc-state.md` and appends a `STAGE_COMPLETED`/`GATE_APPROVED` event to
   the intent's `<record>/audit/` shard — both committed in-repo by
   construction. There is no separate progression call against a remote store.
2. **Entry proof is the engine-native `consumes` / `requires_stage` check.** A
   gate's prerequisite is satisfied by reading the prior gate's Current Stage
   and audit event directly off the same record dir — no cross-store join, no
   binding file.
3. **The audit-path guard makes the audit shard hook-write-only.**
   `rin-gates-audit-guard.ts` (PreToolUse, `Write|Edit|MultiEdit|Bash`) denies
   any hand-write into `aidlc/spaces/*/intents/*/audit/`. So a fabricated
   stage-completion event is impossible — the only audit event that can exist is
   one the engine itself appended on a real `report --result approved`.

Because nothing is mirrored, no attestation, binding, or reconcile tooling is
warranted: a receipt scribe, a receipts tree, an attest step, a receipt guard, and
a slice-binding file all serve only to reconcile a mirror, and under repo-SoR there
is no mirror to reconcile.

**Review-integrity tooling is a separate concern and STAYS.** The decorrelated
review (Gate 5's board of lenses), the **review verdict** + its emitter
(`rin-gates-review-verdict.ts`), the verdict guard, the autonomy gate, and the
**review-scribe** (`rin-gates-review-scribe.ts`) answer "did the harness-set
reviewer roster actually run and converge" — a question about review, not about
remote state. The anti-forgery spine is: autonomy-gate + verdict-guard +
review-scribe + constitution-gate + the audit-path guard, none of it depending on
any external store.

## Gate 5 — the review round-trip as a decorrelated intra-stage cycle

The reviewer↔author round-trip (`pr-review` reviewer session ⇄ `pr-feedback`
author session) is folded into ONE stage, `gate-5-review-cycle`, because the
round-trip is **cyclic** and the pipeline forbids a literal loop: the AIDLC
`requires_stage` DAG is acyclic (compile invariant), and the engine's own stage
machine is forward-only (a `report --result approved` only ever advances
Current Stage). So the cycle lives INSIDE the stage — the §12a bounded
reviewer-iteration loop (`reviewer_max_iterations: 3`), never a DAG back-edge,
never a backward stage advance. `cycles --scope rin-gates` is clean, proving
there is no back-edge.

**The cycle runs as decorrelated agents, not one reviewer.** Gate 5 reuses the
`reviewer: rin-decorrelated-review-agent` seam + `mode: agent-team`, but points
the conductor at a Gate-5-specific board — `knowledge/rin-gates/rin-pr-review-board.json` — whose
producing lenses are the six `pr-review` hunts, each a read-only agent (`tools:
Read, Grep, Glob`, `disallowedTools: Task`) so **reviewer ≠ author is
structural**:

1. `rin-pr-checkers-reviewer-agent` — did the PR weaken/carve-out any gate/check/audit-scope?
2. `rin-pr-evades-reviewer-agent` — letter-passes-spirit-fails (suppressions, casts, tripwires in new shapes).
3. `rin-pr-claims-reviewer-agent` — every authority/completion claim vs the actual record; scope vs the latest decision.
4. `rin-pr-scope-reviewer-agent` — instance quality never launders a scope verdict; OWNER objections are verdicts.
5. `rin-pr-tests-dead-reviewer-agent` — symmetric fakes, unwired bindings, silent defaults, boot-order landmines.
6. `rin-pr-disposition-reviewer-agent` — (re-review rounds) diff the author's disposition table against a fresh atom enumeration; any unresolved/missing/un-acked row ⇒ NOT-READY independent of blocking fixes.

The synthesis lens (`rin-intent-defense-reviewer-agent`, the existing meta-referee)
runs LAST over the collated PASS claims. This is NOT the constitution board (Gate
3's job) — a PR review assumes gates 1–4 + the automation ran and hunts only what
none of them can see.

On NOT-READY the conductor routes findings to the LEAD agent (the author role), who
works the exhaustive `pr-feedback` disposition contract (`fixed@sha` /
`push-back(ground)` / `defer(ack)`, zero unresolved; a {{OPERATOR}} comment closes only
by `fixed` or a {{OPERATOR}}-acked push-back) — the `disposition-table` artefact and the
machine-diffable convergence predicate — then the sweep re-runs.

**Convergence is the only path to `merged`.** The engine's Current Stage stays at
`gate-5-review-cycle` through the whole cycle. On convergence (every lens READY +
intent-defense clean + disposition gap zero + the human's merge) the conductor
calls `report --result approved`, which advances Current Stage and appends the
`merged`-equivalent audit event — committed in-repo, the same transition every
other gate makes. A REQUEST_CHANGES round advances nothing — the absence of that
audit event IS the "still in review" signal.

## Gate 6 — the operational gate (deploy, monitor, bookkeeping)

`gate-6-operate` (operation phase, number 4.1, `requires_stage:
[gate-5-review-cycle]`) exists because a pipeline that stops at merge leaves deploy,
monitoring, and bookkeeping to happen ad-hoc. It is AIDLC's `operation` phase scoped
to one Slice, folding three post-merge concerns:

1. **Deployment** — run the consumer-selected deployment command and retain a
   rollback path for the revision being operated.
2. **Monitoring + live verification** — force the real path and read the
   side-effect; a green health check proves boot, not capability.
3. **Bookkeeping resolutions** — record the operational decision in the
   consumer-selected notes and knowledge surfaces, then reconcile the backlog.

It is decorrelated (`reviewer: rin-decorrelated-review-agent` + `mode:
agent-team`) because the operational review is exactly the judgment automation
cannot encode (deploy sequencing, whether the live verification forced the real
path, security posture on new listeners, whether the books are truly closed).

**The operational done-signal.** Gate 6's completion is the same engine
transition as every other gate: on a live-verified deploy + closed books, the
conductor calls `report --result approved`, which advances Current Stage to the
terminal operated state and appends its audit event to the intent's `audit/`
shard. That committed event is the unforgeable "this Slice is live and its
record is closed" fact — there is no separate DB done-check and no receipt; the
repo record is read directly.

## Per-intent concurrency (no binding, no join)

One workspace runs MANY intents through the pipeline concurrently — work is
multitasked, Gate 0 grooms *potential* items, and AIDLC intents pause/resume.
Each intent is its own self-contained record dir under
`aidlc/spaces/default/intents/`, carrying its own `aidlc-state.md` (Current
Stage) and `audit/` shard. There is no cross-store binding to key work by:
lanes select work by enumerating intents directly off the repo (registry +
per-intent state), and each gate's entry check reads the prior gate's Current
Stage and audit event out of that SAME record dir. Nothing is scattered across
checkouts by construction — the record dir a session reads is the record dir
a session writes.

## Status projection (repo-native enumeration)

`rin-gates-status.ts` is an engine-intent enumerator: it walks `intents.json` + each
intent's `aidlc-state.md` directly and classifies every record by its Current
Stage into the closed set `in-pipeline` (gate 0..5) / `terminal-operate`
(gate-6), consulting the intake store only for the intake queue (unpromoted,
non-archived, `systems`-only captures — those without a `promoted-from.json`
marker). No binding join, no receipt read, no external-stage class. Gate
ownership totality fires per-record against the gate a record sits at. The
projection is regenerable and GITIGNORED — every lane regenerates it at run
start instead of re-deriving pipeline state in prose, and a PR carrying a
`rin-gates-status.*` diff is a defect, not an artefact.

`transition-owners.json` is the projection's companion: it resolves each record's
owning lane by gate (indexed by the `gate` field).

## Files

- `{{HARNESS_DIR}}/aidlc-common/stages/{inception,construction,operation}/rin-gate-*.md` — the seven gate stages (0–6).
- `{{HARNESS_DIR}}/tools/data/stage-graph.json` + `scope-grid.json` — the compiled graph and scope grid.
- `{{HARNESS_DIR}}/scopes/rin-gates.md` — the scope that selects the gates.
- `rin-gates-audit-guard.ts` — PreToolUse path guard (deny hand-writes to `aidlc/spaces/*/intents/*/audit/`).
- `rin-gates-review-verdict.ts` — the guarded emitter for a decorrelated review's convergence verdict (Gate 5's own artefact).
- `rin-gates-review-scribe.ts` — review-integrity scribe: witnesses that the harness-set reviewer roster actually ran and converged.
- `rin-gates-review-roster.ts` (`pnpm rin-gates:review-roster`) — resolves WHICH lenses a gate's board must dispatch, from the same `review-rosters.json` + slug normalizer the scribe and autonomy gate use. Run it before convening a board: a partial or substituted roster produces NO verdict (the scribe withholds the aggregate as `roster incomplete`) while looking like a successful review round.
- `knowledge/rin-gates/rin-pr-review-board.json` — Gate-5 decorrelated board (the six pr-review hunts + intent-defense synthesis).
- `{{HARNESS_DIR}}/agents/rin-pr-*-reviewer-agent.md` — the Gate-5 read-only review lenses.
- `rin-gates-status.ts` — the regenerable, GITIGNORED status projection; an engine-intent enumerator over `intents.json` + each intent's `aidlc-state.md` Current Stage, classifying into `in-pipeline` / `terminal-operate` and consulting the intake store only for the intake queue.
- `rin-gates-derivation-selftest.spec.ts` — the hermetic seam selftest (status projection, promotion tool, autonomy gate, verdict guard/emitter, review-scribe); the pre-push gate runs it.

## Compile + prove

```
bun {{HARNESS_DIR}}/tools/aidlc-graph.ts compile

# Advance a gate (the transition IS the proof — committed Current Stage + audit event):
bun {{HARNESS_DIR}}/tools/aidlc.ts engine orchestrate report --result approved
```
