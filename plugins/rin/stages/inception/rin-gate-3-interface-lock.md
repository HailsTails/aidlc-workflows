---
slug: rin-gate-3-interface-lock
number: 2.40
name: Gate 3 — Detailed Solution Design
plugin: rin
phase: inception
execution: ALWAYS
condition: Fourth gate of the rin pipeline and the inception→construction boundary. Answers "what exactly are we building, measured against reality". Measures the chosen solution's premises and every other external fact first, then designs the domain model, components and exact contracts of the solution Gate 2 chose, with every contract element specified and every external fact it relies on measured. Its `report --result approved` audit event (GATE_APPROVED) is the proof construction's entry check reads.
lead_agent: aidlc-architect-agent
support_agents:
  - aidlc-developer-agent
  - aidlc-quality-agent
mode: mob
reviewer: rin-decorrelated-review-agent
review_artifact: rin-interface-lock
reviewer_max_iterations: 2
approval_mode: autonomous
produces:
  - rin-components
  - rin-interface-lock
consumes:
  - artifact: rin-requirements
    required: true
  - artifact: rin-solution-options
    required: false
requires_stage:
  - rin-gate-2-plan-review
sensors:
  - required-sections
  - dd-1
  - dd-2
  - dd-7
  - upstream-coverage
  - measured-contracts
scopes:
  - rin-unit
  - rin-gates
inputs: The Gate-2 options ledger (see "Inputs, and why the ledger is declared optional"), the record's facts.md, and the Gate-1 requirements
outputs: rin-components.md (the domain model, components, units and their dependencies) and rin-interface-lock.md (the exact contracts, the External reality section, and the single Constitution Check), under this stage's record dir, engine-resolved. The gate is AIDLC-native (ordered walk + approval), proven by the engine's own `report --result approved` audit event; no `.gate-lock` marker file.
---

# Gate 3 — Detailed Solution Design (rin)

MANDATORY: Follow stage-protocol.md — the conductor runs the gate ritual (reviewer, learnings, approval, report) uniformly around this stage. This file describes only the WORK: measure, model, specify, and check. It does NOT present the gate or report.

This gate answers one question: **what exactly are we building, measured against reality.** Gate 2 chose a solution among genuinely different ones. Gate 3 measures what that choice rests on before anything is specified, then designs it exactly — the domain model, the components, and every contract construction will implement — so construction never invents a contract and never builds on an unmeasured fact.

## Inputs, and why the ledger is declared optional

- **`rin-requirements`** (Gate 1) — required.
- **`rin-solution-options`** (Gate 2) — the options ledger, the gate's main input: each decision point's chosen candidate and its premises.

The frontmatter declares the ledger `required: false` deliberately. The engine stops on an absent required consume before any stage body or sensor runs, which would wedge every record that passed Gate 2 before Gate 2 wrote an options ledger. Such a record resumes here and meets every other control. It has no chosen-premise list, so the `measured-contracts` sensor passes it and says so, and the board judges which premises its design rests on. A record that ran the current Gate 2 has the ledger. Gate 2's blocking `solution-options` sensor refuses an absent ledger whenever Gate 2 wrote any of its declared artefacts, and the Gate-2 board refuses the case where it wrote none. Gate 3 does not check this itself: the ledger is an optional consume here.

The record's `facts.md` is read and written here too. It is a record-level ledger no gate produces, so it is not a declared consume.

## The state transition this gate owns

rin is repo-SoR for systems/pipeline work: stage and lifecycle live only in the engine's own record (`intents.json` + `aidlc-state.md` + `<record>/audit/`), never in a remote DB. This gate's transition is the engine's own `report --result approved` — it advances Current Stage and emits a GATE_APPROVED / STAGE_COMPLETED audit event, committed in-repo. That call IS the transition and IS its proof; there is no separate DB call and no receipt artefact. Gate 4 (construction entry) proves this gate's completion the native way — its `consumes` + `requires_stage` frontmatter resolving against the committed record.

There is no `.gate-lock` marker file. The lock is the engine's ordered walk: construction receives no directive until this gate is approved, and an unapproved Gate 3 has no approved `rin-interface-lock.md` for Gate 4 to consume. The approval's committed audit event is what Gate 4 reads.

## A unit record (scope `rin-unit`)

A record under scope `rin-unit` delivers one unit of a parent record's work and enters the pipeline here, with no Gate 0, 1 or 2 of its own. Its opening statement names the parent record and the unit. For such a record:

- **Inputs come from the parent.** The requirements and the approved design that this stage's steps read are the parent's, found through that opening line. The engine reports them as `expected: true` absences in the unit's own record.
- **Premises live in the unit's own `facts.md`.** The unit restates the parent's design premises its piece relies on, measures them there, and cites those rows.
- **A failed parent premise routes back to the parent**, through a new intent or the parent's own backward jump fired by the parent's own run. It never goes through this stage's own route-back to Gate 2, which the unit record skips.

The scope file `{{HARNESS_DIR}}/scopes/rin-unit.md` carries the full entry rule.

## Steps

### Step 1: Entry

Move every existing `contributions/<agent>.md` in this stage directory into `contributions/prior-entry-<YYYYMMDDTHHMMSSZ>/`, where the timestamp is the current UTC time to the second in ISO basic form, exactly as Gate 2's entry does. A Gate 3 → Gate 2 → Gate 3 route-back leaves the first entry's seat files in place, and the engine's seat check reads only their identity line, so a stale file would pass it while the seat has done none of this entry's work.

### Step 2: Measurement

Measure before designing. List every fact the design will rely on:

- every premise of each decision point's chosen candidate, from the `Premises` lines in `rin-solution-options.md`;
- every other external fact the design will rely on — an API's behaviour, a library's capability, a service's limit, an existing file's shape, a measured property of the current system.

Run each fact's probe and write the result into `facts.md`: the status column becomes `live` (the claim held), `corrected` (the claim was wrong and the measured value replaces it) or `withdrawn`, and the value column carries the measured value. A fact that needs a different claim gets a new row rather than a rewritten one. A fact this gate newly relies on gets its own row with its re-derivation. A record with no options ledger (above) measures every external fact its design relies on.

A chosen candidate's premise **fails** when it is measured `withdrawn`, or when it is measured `corrected` and the corrected value no longer supports its point's choice. That judgement is the completeness lens's at review, and the lane's here. A premise measured `live`, or `corrected` and still supporting the choice, lets the design proceed.

**If a chosen candidate's premise fails, stop before any contract work and route back to Gate 2** by the engine's backward jump, which needs no human turn:

1. run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts next --stage rin-gate-2-plan-review`;
2. run the `aidlc-jump.ts execute --target rin-gate-2-plan-review --direction backward --scope rin-gates` command it prints;
3. run `bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts next`.

The jump resets Gate 2 and every later stage, and records `STAGE_JUMPED` with the invalidated artefacts and reviews. Gate 2's own seats, roster and sensors then replan the point in its ledger. This gate never writes Gate 2's artefacts.

### Step 3: Domain model and components

Write `rin-components.md` for the chosen solution: the domain model (entities, value objects, aggregates, and the invariants each holds), the components that own them, and the units of work with their dependencies — the content AIDLC's native domain-design and units-generation stages produce, folded into this gate.

- **One owner per entity.** Every entity is owned by exactly one component; an entity two components both write is a modelling defect to resolve here, not a contract to specify.
- **Units and dependencies.** Each unit is independently testable, and the dependencies between units form an acyclic graph.
- Cite the decision points and chosen candidates the model implements from `rin-solution-options.md`, and the requirements from `rin-requirements.md` each component serves. A record with no options ledger says so.

### Step 4: Exact contracts

Write `rin-interface-lock.md`: every contract the solution exposes or depends on — public signatures, error unions, persisted shapes, wire shapes, events and integration points — together with the versioning and ownership policy for each boundary. This is the content AIDLC's native contract-design stage produces, folded into this gate. Code fences carrying signatures and shapes belong here and nowhere earlier. The old `rin-component-methods` artefact is retired; a record that carried one folds its content into this lock, and nothing restates it elsewhere.

Each contract element is a heading `### <element>` carrying a state line in exactly one of two forms:

- `- **State:** specified` — the element is complete: nothing in it is to be decided later.
- `- **State:** escalated — <reserved class>` — the element cannot be specified without a decision that belongs to a reserved class: a constitution or rules-layer amendment, a recut of ratified scope, weakening a standing guard, a values call the rules do not cover, or money and external identity. An escalated element's remedy is the park, which is how it reaches {{OPERATOR}}; the lock is not approvable while one exists.

There is no third state. An element that cannot be specified for any other reason is a finding to specify here, or a route-back to Gate 2 if the chosen solution cannot support it. A deferred contract is one construction would invent. The completeness lens judges every element's state.

### Step 5: The External reality section

The lock carries a `## External reality` section listing every fact the design relies on, one entry each: `- <key> — <what was measured>`, keyed by its `facts.md` key. The measured value lives in `facts.md`. A design with no external surface writes a single entry, `- none — <reason>`.

The blocking `measured-contracts` sensor refuses approval in these cases:

- a premise of a chosen candidate has no entry here;
- that premise has no `facts.md` row;
- any of the premise's `facts.md` rows has a status other than exactly `live` or `corrected`. A `withdrawn` row has failed and routes back to Gate 2; any other status is measured first;
- the Gate-2 ledger is present but has no `## Point:` section;
- a point's Chosen line does not resolve to exactly one of its candidates;
- the chosen candidate has no readable Premises line;
- the lock, the ledger or `facts.md` cannot be read. This refuses as unmeasured, never as a pass. An absent `facts.md` is read as having no rows, so each chosen premise key is refused as having no row.

The engine fires the sensor only on a lock that exists. An absent lock is therefore not this sensor's refusal: Gate 4's entry refuses it, because it consumes `rin-interface-lock` as required.

Each of the three ledger cases above (no `## Point:` section, an unresolved Chosen line, no readable Premises line) means the ledger cannot say what the design rests on, so it routes back to Gate 2 by the backward jump to correct the ledger. A record with no Gate-2 ledger at all passes the sensor, and its premises are the board's to judge.

The completeness lens checks two further things against this section. First, every other external fact the contracts name must be listed here. Second, every listed key that is not a chosen premise, and every premise of a record with no Gate-2 ledger, must have a `facts.md` row with status `live` or `corrected`. A listed fact still `unmeasured`, or with no row, is a finding: measure it here. A `withdrawn` one routes back to Gate 2 if the design relies on it.

The sensor reads only each row's status word, from files this gate can edit, so the completeness lens also checks that the measuring happened. Every `live` or `corrected` chosen-premise row must carry a measured value produced by its re-derivation. The ledger's chosen Premises lines, and the claim column of every chosen premise's row, must be unchanged since Gate 2's approval: the lens diffs both files against the commit Gate 2 approved. A status set without its measurement, or an edited claim or Premises line, is a finding.

### Step 6: The Constitution Check

The lock carries the Slice's single Constitution Check (CD-38) — it is written here and nowhere else. Confirm the specified contracts need no constitution violation to implement (no `any` in a public signature, every boundary carries a Zod schema, errors are Result-shaped, no class in a domain contract), and cite every concern by CD id.

### Step 7: The review

The reviewer is the board coordinator marker (`rin-decorrelated-review-agent`). The conductor logs the normal reviewer request, then runs `{{HARNESS_DIR}}/knowledge/rin-gates/decorrelated-review.md` inline. Because this gate is listed in `roster_dispatch_gates` in `{{HARNESS_DIR}}/tools/data/review-board.json`, the conductor dispatches **this gate's resolved producing roster** from `review-rosters.json`, then the intent-defense synthesis lens last. The roster is completeness (`aidlc-architecture-reviewer-agent`), ddd-modelling, clean-architecture, and the contract-constitution lens, which judges the contracts against the type-soundness, errors-as-data and zod-boundary rules at contract grain. The dispatch brief tells each lens to read the lock's fenced signatures as code. The conductor writes the supplied review file from the collated board and records its standard review receipt.

The verdict is **READY** or **NOT-READY**. On NOT-READY the findings are fixed in this gate's artefacts and the board re-runs, up to `reviewer_max_iterations`. This stage adds no second counter. A finding still unresolved at the limit is written into the stage's review diagnosis, `review-diagnosis.md` in this stage's record directory, one entry per finding naming its class: one of the reserved classes (a constitution or rules-layer amendment, a recut of ratified scope, weakening a standing guard, a values call the rules do not cover, or money and external identity), or `problem`. A finding that falls in a reserved class parks the record, naming the class. Any other finding is a problem the lane fixes before it convenes again. Once the iterations are spent, the lane convenes again only through the gate's rejection-and-revision path (`stage-protocol-reviewer.md`), which restarts the review budget. Each restart is recorded in the review diagnosis, and nothing yet caps how many there are. Seats never review.

Stop here — the conductor runs the reviewer, learnings, and approval. On READY, the conductor's own `report --result approved` call is this gate's transition — no further step is required of this stage's work.

## Refuses (invariants)

- **Measure before specifying.** No contract is written on an unmeasured premise; a failed chosen-candidate premise routes back to Gate 2 first.
- **Every element specified.** Two states only, `specified` or `escalated`, and only `specified` is approvable.
- **This gate writes only its own artefacts** (and the status and value columns of `facts.md`, plus new fact rows). It never edits Gate 2's ledger; a design choice that must be re-opened goes back to Gate 2 by the backward jump.
- **Design, don't task.** No task list and no implementation. Construction is Gate 4.
- **No marker file.** The lock is the native gate + the committed `report --result approved` audit event.
- **Locked is scope, not waivable debt.** A locked interface (IF-N) is ratified scope; it is never re-widened as inherited debt at Gate 4.

## Learn

While running this stage, maintain a running log in `<record>/<phase>/<stage>/memory.md` (create on stage start if absent). Append entries under: Interpretations, Deviations, Tradeoffs, Open questions — each with an ISO 8601 timestamp.

Stage files are immutable framework artefacts — the ritual writes into the harness, not into this file.
