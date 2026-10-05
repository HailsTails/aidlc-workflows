---
slug: rin-gate-2-plan-review
number: 2.30
name: Gate 2 — Solution Options
plugin: rin
phase: inception
execution: ALWAYS
condition: Third gate of the rin pipeline. Answers "which solution, among genuinely different ones, and why". Names each decision point, enumerates genuinely different solution shapes for it, writes each candidate's premises as facts.md keys, compares the candidates on the rows that separate them, and records the choice inline in the options ledger with a reason for every rejected candidate. Prose and diagrams only; contracts belong to Gate 3.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-developer-agent
  - aidlc-quality-agent
  - rin-challenger-agent
mode: mob
reviewer: rin-decorrelated-review-agent
review_artifact: rin-solution-options
reviewer_max_iterations: 2
approval_mode: autonomous
produces:
  - rin-solution-options
  - rin-options-questions
consumes:
  - artifact: rin-requirements
    required: true
  - artifact: rin-framing-questions
    required: false
requires_stage:
  - rin-gate-1-framing
sensors:
  - required-sections
  - dd-1
  - dd-2
  - dd-7
  - upstream-coverage
  - framing-only
  - solution-options
scopes:
  - rin-gates
inputs: The Gate-1 requirements artefact, and the answered framing questions where the record holds them
outputs: rin-solution-options.md (the options ledger — decision points, candidates with their premises, the comparison, and the decision on each point) and rin-options-questions.md (the entry-read citation, what each seat was asked and answered, and the disposition of every seat objection), under this stage's record dir, engine-resolved
---

# Gate 2 — Solution Options (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual (reviewer, learnings, approval, report) uniformly around this stage. This file describes only the WORK: enumerate genuinely different solutions, compare them, and record the choice. It does NOT present the gate or report.

This gate answers one question: **which solution, among genuinely different ones, and why.** Gate 1 framed the problem and fixed what must be true of any answer. Gate 2 lays several answers side by side against those requirements and chooses one, with the rejected ones kept and the reasons written down. Gate 3 then measures what the chosen one rests on and designs it in detail.

## Artefacts

- **`rin-solution-options.md` — the options ledger.** The decision points, every candidate with its premises, the comparison, and the decision on each point: the candidate chosen and a reason for each one rejected. This is the artefact the reviewer judges.
- **`rin-options-questions.md` — the gate's working record.** The entry-read citation, what each seat was asked and what it answered, and the disposition of every seat objection.

The ledger's grammar is fixed below, because the blocking `solution-options` sensor reads it and Gate 3's `measured-contracts` sensor reads the chosen candidates' premises from it.

## The state transition this gate owns

When the review is READY, this gate's transition IS the engine's own `report --result approved` — it sets Current Stage forward and writes the GATE_APPROVED / STAGE_COMPLETED audit event, committed in-repo. There is no separate DB call and no receipt artefact; the conductor fires it as part of the gate ritual.

## Steps

### Step 1: Entry

**Archive stale seat files first.** Move every existing `contributions/<agent>.md` in this stage directory into `contributions/prior-entry-<YYYYMMDDTHHMMSSZ>/`, where the timestamp is the current UTC time to the second in ISO basic form (for example `prior-entry-20260924T141503Z`). The engine's seat check reads only a contribution file's identity line, so a file left from an earlier entry would pass it while the seat has done none of this entry's work. This covers a first run under this definition and every re-entry through the backward jump alike. The second-level timestamp keeps a second re-entry on the same day from overwriting the first's evidence, and the name carries no `:`, which NTFS rejects.

**[ENTRY-READ]** Then read what earlier passes already decided, so this pass neither repeats a rejected shape unknowingly nor silently reverses a decision:

- this record's own `rin-solution-options.md`, if it exists (a re-entry): every point's decision and every rejected candidate with its reason;
- legacy ITERATE entries in older plan-review questions files across the active space. Resolve the ACTIVE SPACE's intents root through the engine — never a literal space name, because a glob naming one space returns nothing in a workspace whose space is named differently, and an empty result would then read as a clean one:

```
git grep -ln "ITERATE" -- '<intents-root>/*/inception/rin-gate-2-plan-review/*plan-review-questions.md'
```

Judge overlap with this record semantically, never by string match.

**[CITE-NIL]** Record the result in `rin-options-questions.md` — the overlapping decisions and records found, or an explicit nil. An uncited entry-read is an incomplete gate pass.

### Step 2: Enumerate the candidates

Name each **decision point** — a place where the solution could genuinely go more than one way — as a short kebab-case name (`storage`, `identity`, `delivery-channel`). A record may have several.

For each point, enumerate **genuinely different solution shapes — aim for three.** Genuinely different means they differ in shape — where the state lives, which component owns a concern, which mechanism carries the behaviour, what is built versus reused — not in a parameter of one shape. A candidate written only to be rejected is not genuine. The sensor refuses fewer than two; whether a point with two needed a third is the board's judgement, so when a third honest candidate cannot be found, say what was searched and why the space is that narrow.

**Adopted work is one candidate, never the answer.** A prior draft of this gate, a prescription carried from the capture, a shape written into the requirements, or an approach from an earlier PR enters the ledger as one candidate beside the others and is compared like them.

**Premises are facts.md keys.** Every external thing a candidate relies on — an API's behaviour, a library's capability, a service's limit, a file's shape, a measured property of the current system — is a row in the record's `facts.md`, with the claim stated and a re-derive column naming the probe that would measure it.

- A premise this entry introduces gets a new row with status `unmeasured`.
- On a re-entry after a Gate-3 route-back, a row an earlier Gate 3 measured keeps its measured status.
- A `withdrawn` premise may be cited only by a rejected candidate. The candidate's `Premises` line cites those keys. Gate 3 measures the chosen candidates' premises; this gate never marks a premise measured. A premise found to be wrong is recorded by a new row, not by rewriting a cited one; the board judges edits to cited rows.

### Step 3: Compare

Compare the candidates in the ledger's `## Comparison` section **on the rows that separate them** — the Gate-1 requirements and invariants where the candidates differ, plus cost, reversibility and risk where they differ. A requirement every candidate meets the same way is not a row. Cite requirements by their Gate-1 ids so the comparison is traceable to `rin-requirements.md`. A requirement no candidate satisfies is a finding about the framing: record it and, if it cannot be resolved here, route back to Gate 1.

Before convening the seats, write in `rin-options-questions.md` which candidate the lead is leaning towards on each point, so the challenger knows what to argue against.

### Step 4: Convene the seats

Each seat is dispatched with a brief naming the concrete act it performs, per the ensemble contract (`{{HARNESS_DIR}}/knowledge/rin-gates/ensemble-contract.md`). Seats do work; they do not review.

- **Developer** — probes the riskiest premise now, while options are cheap: runs the read-only probe the fact row names where it can, and reports what it found in its contribution. A falsified premise at this gate changes the comparison and usually rejects the candidate; it does not change the fact row's status, which is Gate 3's.
- **Quality** — writes the acceptance tests implied by the candidate the lead is leaning towards and by the candidate the challenger argues for, as Given/When/Then prose, and reports which of the two cannot satisfy one and why.
- **Challenger** (`rin-challenger-agent`) — builds the strongest case for the candidate the lead is leaning against, with evidence it gathered itself, and states what would have to be true for that candidate to win.

Record in `rin-options-questions.md` what each seat was asked, what it answered, and a disposition for every objection it raised (folded, with where; or rejected, with the reason).

### Step 5: Record the decision

Record the decision on each point inline in the ledger, in the grammar below: the candidate chosen, a reason for every other candidate on that point, and the consequences of the choice — including what it makes harder later and how reversible it is.

A replan (a route-back from Gate 3) rewrites the point's decision in place: the new choice, the earlier choice added to the rejected ones with the reason it no longer holds, and the route-back that caused it named in the consequences. The earlier text lives in git history; the board judges whether a replan kept every rejected reason.

### Step 6: The review

The reviewer is the board coordinator marker (`rin-decorrelated-review-agent`). The conductor logs the normal reviewer request, then runs `{{HARNESS_DIR}}/knowledge/rin-gates/decorrelated-review.md` inline. This gate is listed in `roster_dispatch_gates` in `{{HARNESS_DIR}}/tools/data/review-board.json`, so the conductor dispatches its resolved producing roster from `review-rosters.json` (`pnpm rin-gates:review-roster --gate rin-gate-2-plan-review`): the architecture reviewer, `rin-ddd-modelling-reviewer-agent` and `rin-clean-architecture-reviewer-agent`, then the intent-defense synthesis lens last. The conductor writes the supplied review file and records the standard review receipt. The producing lenses judge whether the candidates are genuinely different, whether a point needed a third, whether the comparison covers every row that separates them, and whether the choice follows from it. A Gate 2 that wrote none of its declared artefacts dispatches no sensor, so a missing ledger is the board's to refuse. The ledger is the gate's review artefact, so without it there is nothing for the board to judge READY.

The verdict is **READY** or **NOT-READY**, as at every gate. On NOT-READY the findings are fixed in this gate's artefacts and the board re-runs, up to `reviewer_max_iterations`. This stage does not add a second counter. A finding still unresolved at the limit is written into the stage's review diagnosis, `review-diagnosis.md` in this stage's record directory, one entry per finding naming its class: one of the reserved classes (a constitution or rules-layer amendment, a recut of ratified scope, weakening a standing guard, a values call the rules do not cover, or money and external identity), or `problem`. A finding that falls in a reserved class parks the record, naming the class. Any other finding is a problem the lane fixes before it convenes again. Once the iterations are spent, the lane convenes again only through the gate's rejection-and-revision path (`stage-protocol-reviewer.md`), which restarts the review budget. Each restart is recorded in the review diagnosis, and nothing yet caps how many there are.

Stop here — the conductor runs the reviewer, learnings, and approval; on READY the approval's `report --result approved` is this gate's transition.

## The options ledger grammar (`rin-solution-options.md`)

- Each decision point is a section `## Point: <kebab-case name>`, opening with what makes it a decision point.
- Each candidate for that point is a heading `### Candidate <letter> — <name>` inside the point's section, carrying a description of the shape in prose (and a mermaid diagram where it helps) and a `- **Premises:**` line in exactly one of two forms:
  - a comma-separated list of `facts.md` keys, for example `- **Premises:** OT-1, OT-2`. A key is uppercase letters, a hyphen, then digits, the same shape the doc-discipline reader uses;
  - `- **Premises:** none — <reason>`, for a candidate that relies on no external fact.
- The point's decision, inside the point's section: `- **Chosen:** <letter>`, one `- **Rejected <letter>:** <reason>` line for every other candidate on the point, then the consequences as prose.
- One `## Comparison` section, per Step 3.
- Letters are unique across the whole ledger, and a candidate, once written, is never deleted; a rejected one stays with its reason.

## Refuses (invariants)

- **Prose and diagrams only.** No code fence tagged with a programming language — the blocking `framing-only` sensor refuses it. Mermaid diagrams, evidence fences (shell, console, text) and plain data fences are allowed, because the derivation rail requires re-runnable commands. Whether prose, or an untagged, evidence or data fence, smuggles in a signature, an error union or a wire shape is the board's judgement; those are Gate 3's.
- **Genuinely different candidates on every point, with the choice and every rejection reasoned.** The blocking `solution-options` sensor refuses an absent ledger (whenever the gate has written at least one of its declared artefacts, since the engine fires a gate sensor only on declared artefacts that exist), a ledger with no `## Point:` section, a point with fewer than two distinct candidates, a letter listed twice on a point, a candidate without a readable Premises line, a Chosen line that is missing or does not name exactly one of the point's candidates, an unchosen candidate without a reason, and a Rejected line that names the chosen candidate or a letter that is not one of the point's candidates. The board judges everything else, including whether each cited premise key has its `facts.md` row: `unmeasured` when this entry introduced it, the status an earlier Gate 3 measured otherwise, and `withdrawn` only where a rejected candidate cites it.
- **Never delete a rejected alternative.** A replan keeps every earlier rejection and adds the earlier choice to them.
- **This gate writes only its own artefacts** (and new `facts.md` rows). It never edits Gate 1's requirements or Gate 3's design; a requirement that must change routes back to Gate 1.
- **Seats never review.** The conductor dispatches the resolved roster and intent-defense synthesis through the board coordinator protocol.

## Learn

While running this stage, maintain a running log in `<record>/<phase>/<stage>/memory.md` (create on stage start if absent). Append entries under: Interpretations, Deviations, Tradeoffs, Open questions — each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the harness, not into this file.
