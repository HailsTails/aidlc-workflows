---
slug: user-stories
number: 2.4
name: User Stories
phase: inception
execution: CONDITIONAL
condition: Execute when user-facing features, multiple personas, complex business logic, or cross-team work is involved. Skip for pure refactoring, isolated bug fixes, infrastructure-only changes, or developer tooling.
lead_agent: aidlc-product-agent
support_agents:
  - aidlc-design-agent
  - aidlc-developer-agent
  - aidlc-quality-agent
mode: mob
summary_confirmation: required
reviewer: aidlc-product-lead-agent
review_artifact: stories
reviewer_max_iterations: 2
review_class: advisory
produces:
  - stories
  - personas
  - user-stories-assessment
  - traceability
consumes:
  - artifact: requirements
    required: true
  - artifact: business-overview
    required: false
    conditional_on: brownfield
  - artifact: component-inventory
    required: false
    conditional_on: brownfield
  - artifact: team-practices
    required: false
requires_stage:
  - requirements-analysis
sensors:
  - required-sections
  - upstream-coverage
  - traceability
scopes:
  - enterprise
  - feature
  - mvp
  - classic
  - workshop
inputs: <record>/inception/requirements-analysis/requirements.md, RE artifacts (if brownfield)
outputs: stories.md, personas.md, user-stories-assessment.md, traceability.json (under this stage's record dir, engine-resolved)
---

# User Stories

## Steps

### Step 1: Load the Lead Persona (mob stage)

Read every path in `directive.inline_context_paths` per the stage protocol. For
this mob the roster contains the aidlc-product-agent persona and its shared/role
knowledge only; the product manager writes its own pieces and assembles the outputs.

This stage runs `mode: mob` (stage-protocol-ensemble.md §5 "Multi-agent stages"): the support agents (aidlc-design-agent for user experience, aidlc-developer-agent for implementability, aidlc-quality-agent for testability) are NOT voices to adopt — they are dispatched as independent participants during PART 2. Do not load their personas into your own context.

### Step 2: Validate User Stories Are Needed

Assess whether user stories add value for this project. Provide reasoning:
- **Execute if**: user-facing features, multiple user personas, complex business logic, cross-team coordination needed
- **Skip if**: pure refactoring, isolated bug fixes, infrastructure-only, developer tooling

Create `<record>/inception/user-stories/user-stories-assessment.md` documenting the assessment:
- Decision: Execute or Skip
- Rationale: Why user stories are or are not needed for this project
- Factors considered: project type, user-facing scope, complexity signals
- If executing: key areas where stories will add the most value
- If skipping: what alternative coverage exists (e.g., requirements alone are sufficient)

If skipping, run
`{{INVOKE}} engine orchestrate report --stage user-stories --result skipped --reason "<reason>"`.
The engine records the skip and advances to the next in-scope stage.

### Step 3: Load Prior Context

- Read `<record>/inception/requirements-analysis/requirements.md`
- If brownfield: Read relevant RE artifacts from `aidlc/spaces/<active-space>/codekb/<repo>/` (the directory `codekb-path --repo <repo>` prints)

---

## PART 1: Planning

### Step 4: Create Story Plan with Questions

Create a story plan in `<record>/inception/user-stories/user-stories-questions.md` containing:
- **Persona development approach** — Who are the users? What are their goals?
- **Story format** — Using INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- **Story prioritization** — Assign MoSCoW priority (Must Have / Should Have / Could Have / Won't Have) to each story based on requirements analysis. The MVP boundary will be formally decided during Delivery Planning; story priorities inform that decision.
- **Breakdown approach options** — By feature, by persona, by workflow, by domain area, by epic
- **Embedded questions** — Using [Answer]: tag format for user input on personas, story granularity

### Step 5: Collect Answers

Collect answers following stage-protocol.md §3 question flow (offer interaction mode choice, collect answers, write back to file).

### Step 6: Analyze Answers

MANDATORY ambiguity analysis:
- Scan ALL responses for vague language ("mix of", "not sure", "depends", "probably")
- Check for contradictions between answers
- Identify missing details
- Create follow-up questions if ANY ambiguity found

### Step 7: Present plan and generate

Present the story plan summary (persona count, story count, breakdown approach) inline. Then immediately proceed to PART 2: Generation. The user will review and approve the combined output (plan + generated stories) at the completion gate.

If the user interjects with feedback before generation completes, treat it as a revision request — update the plan accordingly before continuing generation.

---

## PART 2: Generation (mob elaboration)

### Step 8: Execute Plan — Generate Stories and Personas via the Mob

The two outputs are written in the mob rounds of stage-protocol-ensemble.md §5
`mode: mob`, from the approved plan, the Q&A file and `requirements.md`, and the
Product Leader reviews afterwards (`stage-protocol-reviewer.md` §12a). The
pieces and their authors:

**`<record>/inception/user-stories/personas.md`** — design:
- User persona definitions (name, role, goals, pain points, context)
- Persona relationships and priority ranking

**`<record>/inception/user-stories/stories.md`:**
- Lead: user stories in standard format: "As a [persona], I want [goal], so that [benefit]", each with a stable `US{group}.{seq}` ID (for example `US1.1`), and each story's priority (Must Have / Should Have / Could Have / Won't Have).
- Quality: acceptance criteria for each story, each with a three-segment `AC{story-group}.{story-seq}.{criterion-seq}` ID (for example `AC1.1.1`).
- Developer: story dependencies and relationships, and INVEST compliance notes.

When `directive.support_agents` is empty, the lead writes every piece (§5).
Maintained dissent is quoted verbatim in the Step 10 completion summary.

**Write element-level traceability.** Create
`<record>/inception/user-stories/traceability.json`. Enumerate every `FR` and
`NFR` ID from `requirements.md` in `upstream_ids`, with one `coverage` row per
ID. `OK` targets must name one or more existing `USx.y` IDs. Use `Deferred`
only with a named downstream stage and `N/A` only with a justification:

```json
{
  "stage": "user-stories",
  "upstream_ids": ["FR1", "FR2", "NFR1"],
  "coverage": [
    { "id": "FR1", "status": "OK", "target": "US1.1, US1.2" },
    { "id": "NFR1", "status": "Deferred", "target": "nfr-requirements" },
    { "id": "FR2", "status": "GAP" }
  ]
}
```

### Step 9: Open the Approval Gate

After verifying the three lead artifacts and every dispatched collaborator's
contribution file (none on a lead-only run), run:

```bash
{{INVOKE}} engine orchestrate report \
  --stage user-stories --result awaiting-approval
```

If the engine refuses missing or malformed ensemble evidence, restore that
evidence before presenting the human gate.

### Step 10: Present Completion & Request Approval

Use stage-protocol.md completion template with completion emoji: :books:
- Summary of personas and stories produced
- Review path: `<record>/inception/user-stories/`
- Structured approval question with options: Approve / Request Changes. On the Approve option's description write `Continue to <next stage name>`, taking that name from the `next_stage` field of the reply that opened the gate, else the run-stage directive's (`Complete workflow` when it is null) - the user sees the real stage name, never a field name.

STOP for the human response, then read it. Report **Approve** with
`--result approved --user-input "Approve"`; report
**Request Changes** with `--result rejected --user-input "Request Changes"`
(their words are kept with the record; add `--reason` only to say more), run the
revision loop, and report `--result revised` before re-presenting. The engine
owns every lifecycle transition and advancement.

## Sensors

This stage's outputs are markdown artefacts under `<record>/inception/user-stories/`.

Imports: `required-sections`, `upstream-coverage`, `traceability`.

Upstream targets: `requirements`, `business-overview`, `component-inventory`, `team-practices`.

`traceability` owns `traceability.json`, verifies every requirement is
declared and covered, and checks that each `OK` target exists in `stories.md`.

## Learn

When `directive.protocol_modules` lists `learnings`, follow
`stage-protocol-learnings.md`: keep the diary at `directive.memory_path` while
working and run the ritual before the approval gate, applying its bootstrap,
`single: true`, per-unit, and gate-revision exemptions. When the module is absent,
skip both the diary and the ritual.
