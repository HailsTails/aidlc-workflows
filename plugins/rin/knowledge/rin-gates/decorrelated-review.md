# Decorrelated Review Protocol (rin's parallel lens sweep)

This protocol is how the conductor runs a **decorrelated multi-lens review** when the stage reviewer flow names `rin-decorrelated-review-agent`. That agent is a marker, not a reviewer subagent. The conductor keeps the normal reviewer request and receipt, runs the board inline, and writes the board's verdict to the supplied review file.

The catalogue is **data**, not prose: `{{HARNESS_DIR}}/tools/data/review-board.json` lists the producing lenses (each a read-only reviewer agent under `{{HARNESS_DIR}}/agents/`) plus the `defended-on-intent` synthesis lens. Which lenses a gate dispatches is also data, and only one file holds it: the gate's roster in `{{HARNESS_DIR}}/hooks/review-rosters.json`, which is also the floor the review-scribe enforces (Step 1).

## Why decorrelated, not a single reviewer

A single generalist reviewer is the failure pattern this protocol exists to
prevent (rin Gate 3: "No omnibus validator. Validation MUST be the multi-lens
parallel sweep"). Each lens reads ONE concern, blind to the others, adversarial
within its single lane. The catch-rate lives in the decorrelation: a bug that
reads acceptable through one lens is caught by the lens that owns its actual
concern, and the `defended-on-intent` meta-referee catches the
letter-pass-intent-fail gap no single reviewer and no script can.

**reviewer ≠ author is structural** — every lens agent carries `tools: Read,
Grep, Glob` + `disallowedTools: Task`. Every lens stays read-only, and only the
conductor dispatches other agents.

## Procedure

When a stage directive names `reviewer: rin-decorrelated-review-agent`, run the following steps in the conductor's §12a reviewer step. Log the normal review request first and retain its `reviewFile`, artifact paths, iteration and any prior findings. Do not invoke the marker agent.

### Step 1 — Resolve the review surface + roster

- Read `{{HARNESS_DIR}}/tools/data/review-board.json` and resolve the producing lenses to dispatch:
  - **For a gate listed in `roster_dispatch_gates`**, read that gate's roster from `{{HARNESS_DIR}}/hooks/review-rosters.json`, dispatch its producing lenses, then the synthesis lens last. The synthesis lens is never a producing lens, whether or not the roster names it. The roster is the required set. A lens the gate's roster comment names as optional is dispatched when the comment's condition holds, and its verdict then gates the aggregate like any roster lens.
  - **Gate 5** has its own board file and follows its own stage's dispatch. Its roster in `review-rosters.json` is the same set.
- The review surface is the stage's produced artifacts + the code/interfaces under review (for Gate 2: the options ledger and questions; for the Gate-3 detailed solution design: the components and the interface lock, whose fenced signatures each lens reads as code — say so in the dispatch brief, and tell the completeness lens that it judges four Gate-3 invariants no sensor checks: every contract element's state is `specified` or `escalated`; every external fact a contract names is listed under the lock's `## External reality`; every key listed there that is not a chosen premise, and every premise of a record with no options ledger, has a facts.md row whose status is `live` or `corrected`; and a chosen premise whose facts.md status is `corrected` still supports its point's choice or routes back to Gate 2; for Gate 4: the generated code diff for the Slice, with its code-generation plan).
- **Pin the tree the lenses will read, and know its commit.** Lenses carry
  `tools: Read, Grep, Glob` — no Bash, no `gh` — so they cannot fetch, check
  out, or verify where they are: they review whatever tree they are launched
  in. Resolve the review surface to an absolute checkout path and record its
  head sha before dispatching. For a pull request, prepare that checkout with
  the review-worktree tool. For the working branch's artefacts, record the
  current checkout and sha. If either binding is absent, do not dispatch a
  lens or claim a verdict.

### Step 2 — Fan out the producing lenses IN PARALLEL

Dispatch one subagent per producing lens resolved in Step 1, concurrently to the harness's available capacity. On Claude Code use one parallel `Task` batch; on Codex use `spawn_agent` calls and wait for each result. Each dispatch:

- targets the lens's `agent` (e.g. `rin-naming-reviewer-agent`);
- binds the Step-1 tree and passes its sha. Use the harness's working-directory
  binding when available. On Codex, where `spawn_agent` has no `cwd` argument,
  pass the checkout's absolute path and require the lens to use it as `workdir`
  for every filesystem tool call. If the lens cannot do that, it returns
  `CANNOT-REVIEW`; the conductor treats this as NOT-READY;
- passes ONLY: the stage definition path, the artifact/code file paths, and the
  Q&A file path — never memory.md, never plan.md, never another lens's findings;
- lets the agent load its own persona + the project's `cd-*`/method rules for its
  lane.

A lens dispatched without a bound checkout may inherit a different tree. Where
that tree is not the review surface — the Gate-5 sweep, whose rails pin it to
`main` — the lens reads already-merged code as though it were the diff and
returns findings that are confidently, precisely wrong while reading exactly
like sound ones.

**Pass the Step-1 sha into every lens prompt — this is now load-bearing, not
advisory.** The review-scribe enforces the echo mechanically: a
`READY` that does not carry the resolved head sha is discarded and never counted
toward the roster, so a board dispatched without the sha in its prompts converges
on nothing and the gate refuses the approve. A `NOT-READY` is captured either way
— a refusal is never dropped for a missing echo, because dropping refusals is the
one direction this machine must never move in. A lens that cannot confirm its tree
returns `CANNOT-REVIEW`, which the scribe records as an abstention rather than
reading it as a malformed verdict.

This replaces the previous instruction to the conductor to discard unbound
verdicts by hand: that step relied on the lead remembering, and it reached only
the six `rin-pr-*` lenses whose definitions described it. Every reviewer agent
now carries the contract, and the tool applies it regardless.

Each lens returns a `## Review` verdict: READY / NOT-READY with cited findings
(`file:line | quoted code | <CD-id> | defect-named`).

**Do not ask a lens to reproduce an exact delimiter block.** Its native `## Verdict`
section IS the capture channel: the `SubagentStop` review-scribe extracts the
verdict from it deterministically (`rin-gates-lens-verdict.ts`). Asking a model to
emit an exact string was measured losing 399 of 887 captures across every lens,
and pasting the template into every agent definition did not fix it (task
019fd9a5). A lens that ends with a plain `## Verdict` section stating READY or
NOT-READY is captured correctly.

### Step 3 — Collate

Assemble every lens's findings into one bundle: the PASS claims (READY lenses +
each lens's individually-passed checks) and the VIOLATION rows (NOT-READY
findings). Keep it pointer-style, not transcripts.

### Step 4 — Run the intent-defense synthesis LAST

Invoke `rin-intent-defense-reviewer-agent` (the `defended-on-intent` synthesis
lens) as a single subagent, AFTER the producing lenses return. Its denominator is
the **collated PASS claims** from Step 3 — it re-tests each against the intent of
the cited rule, not its letter, and reports `pass-claims-tested=N`,
`pass-claims-excluded=E`, `letter-vs-intent-gaps=K`. A surviving gap flips a
letter-level PASS to a VIOLATION on the owning lens.

### Step 5 — Verdict + iteration

- **READY** iff every producing lens is READY (or its VIOLATIONs resolved at a
  principled bar) AND the intent-defense pass finds zero surviving
  letter-vs-intent gaps.
- **NOT-READY** on any surviving VIOLATION or intent gap: route the cited findings back to the builder, re-run the stage body to fix, then re-run the sweep — up to `reviewer_max_iterations`. A finding still unresolved at the iteration limit is written into the stage's review diagnosis, `review-diagnosis.md` in the stage's record directory, one entry per finding naming its class: one of the reserved classes (a constitution or rules-layer amendment, a recut of ratified scope, weakening a standing guard, a values call the rules do not cover, or money and external identity), or `problem`. It is never carried into an approval. A finding in a reserved class parks the record, naming the class. Any other finding is a problem the lane fixes before it convenes again. Once the iterations are spent, the lane convenes again only through the gate's rejection-and-revision path (`stage-protocol-reviewer.md`), which restarts the review budget. Each restart is recorded in the review diagnosis, and nothing yet caps how many there are.

### Step 6 — Write the review and emit the rin-gates verdict

The conductor writes exactly one review file at the path supplied in the reviewer request.

The scribe defaults to the producer's conductor report route. Its guarded
verdict includes each latest lens's exact report text, findings and native
agent/session/channel/head provenance under `reports`. Read these as review
data, together with the prior findings retained from the engine brief. Preserve
the reported severity, workspace-relative location, finding and required action;
do not infer missing fields from a citation string. If a lens omitted a required
severity, location, action or prior response, request that lens's own supplement
before recording the report. Preserve the engine's prior
IDs and reported `Fixed`/`Still applies` responses without inventing a decision.
If `reportsComplete` is false, re-dispatch the missing report before recording
a verdict. The scribe does not request or complete an engine review and never
appends to the reviewed artifact on this route. Use the already-open request's
exact `reviewFile` and returned `recordVerdict` once.

`RIN_GATES_ENGINE_REVIEW_ROUTE=conductor-report` explicitly selects this default
for a project hook invocation. `legacy-append` is compatibility for an old engine
whose successful request does not advertise `reviewFile` or `recordVerdict`.
It cannot select the legacy writer for a modern request, a prerequisite response,
or a pending/exhausted request refusal. Never use it as a remedy for a modern
report failure.

Use the stage reviewer template: one rendered `**Verdict:** READY|NOT-READY`,
`**Reviewer:** rin-decorrelated-review-agent`, and `**Iteration:** <n>` line,
with cited findings in its `### Findings` table. Include the reviewed head sha,
the producing roster and the intent-defense counts. Preserve prior finding IDs
on re-dispatch. Do not write to the stage's produced artefacts. The conductor
records the normal `REVIEW_COMPLETED` receipt from this review file through
`stage-protocol-reviewer.md` §12a. An incomplete roster, a `CANNOT-REVIEW`, or a
missing synthesis is NOT-READY; never manufacture a READY receipt.

For a **rin-gates**-scope stage, the sweep's convergence IS the verdict artefact:
computing the verdict above is not complete until it is emitted through the
guarded emitter. This is the seam that makes autonomy enforced rather than
instructed — the rin-gates autonomy backstop hook
(`rin-gates-autonomy-gate.ts`) refuses the gate's `report --result
approved` unless a fresh, work-bound verdict exists, and that verdict is
**tool-writable-only** (a hand-written one is denied by
`rin-gates-verdict-guard.ts`). So the review's own output is the only thing that
can unblock the approve; there is no separate "remember to write the verdict"
step and no way to hand-fabricate one.

The SubagentStop review-scribe captures the lens verdicts and emits the
rin-gates verdict when the declared roster is covered. The conductor does not
write `review-verdict.json` or invoke a shell emitter. After the lenses return,
read the guarded verdict and require its gate, head sha, roster and outcome to
agree with the review file. If it is absent or disagrees, the review file is
NOT-READY and names that failure. The autonomy gate independently requires the
guarded verdict before approval.

The guarded verdict applies the findings gate: a `READY` carrying a finding that is not disposed **with its evidence** —
`fixed@<sha>`, `push-back(<ground>)`, `defer(ack:<ref>)`, or
`withdrawn(<reason>)` — is REFUSED. A bare disposition word disposes of nothing, and the
parentheses are load-bearing (they delimit the author's ground from the finding
text, which otherwise self-justifies — every cited finding carries a CD-id and a
coordinate by construction). This
is the second clause of the Step-5 rule above ("or its VIOLATIONs resolved")
made mechanical rather than remembered; the SubagentStop review-scribe applies
the predicate to each lens's own verdict section. Collate every cited finding;
omitting one does not remove it from the scribe's guarded verdict. Non-rin-gates
scopes use the ordinary reviewer receipt and approval ritual.

## Model selection (per each lens's projected frontmatter)

Each lens runs on the model its own projected agent definition declares. Dispatch
each lens with no model override: the agent's `tier:` is the source of its
harness-specific model projection. The roster carries no per-lens model.

## Where it fires in the lifecycle

The stages naming `rin-decorrelated-review-agent` as their reviewer are read from the compiled stage graph, and the lenses each one dispatches are its roster in `review-rosters.json`. Neither is listed here, so neither can drift from its source. Gate 5 dispatches its own board file, as its stage defines. A gate that names a single reviewer (Gates 0, 1 and 6) runs that reviewer alone, and its roster is that one reviewer.
