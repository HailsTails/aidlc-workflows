# Ensemble Protocol Module

Load this module when `directive.mode` is `subagent`, `pipeline`, or `mob`, or when the stage declares support agents; use only the harness subsection that matches the active harness.

## 5. Multi-agent stages (ensemble topologies)

Some stages use multiple agents (e.g., Feasibility uses aidlc-architect-agent + aidlc-aws-platform-agent + aidlc-compliance-agent). How the support agents participate is governed by the directive's `mode` — the stage's communication topology — never by the mere presence of `support_agents`. The roles are constant across topologies: the **lead agent** owns the stage's `produces[]` artifacts, **support agents** collaborate as real participants who write their own work, and the `reviewer` (stage-protocol-reviewer.md §12a, when declared) verifies from outside afterwards. The orchestrator is the bus on every topology: every exchange between participants is a dispatch it makes and a return it carries. Agents do NOT invoke each other — only the orchestrator delegates.

**The directive's `support_agents` is authoritative — dispatch exactly those agents, and no others.** It is the effective list for THIS run: the engine has already applied the collaborators switch (the scope-owned `collaborators` ceremony; see `stage-protocol.md`), so a stage whose authored frontmatter names support agents may still arrive with `support_agents` empty. **An empty list means the lead runs alone, on every topology.** The lead then IS the sole and final author: it does the stage's whole body itself and leaves the `produces[]` artifacts complete — on a `pipeline` the lead is the only link and performs both the scan and the synthesis the chain would otherwise split; on `subagent`/`mob` there is simply no spoke round to dispatch or integrate. A lead-only run writes no contribution files and needs no link receipt beyond the lead's own. Never dispatch an agent that is not in `directive.support_agents`, and never infer collaborators from the stage body's prose or from the authored frontmatter. This rule is the single source of truth for who participates; stage bodies describe the full-roster case and defer to it.

**What the user hears while an ensemble runs.** These handoffs happen inside a stage, past the reach of a directive's `narration`, so the sentences are written here. Only the double-quoted text is spoken; fill the `[bracketed]` slots and drop the brackets.

- Handing a specific question to one specialist - **SAY:** "Let me bring in the [trade] on [the specific question, in plain terms]."
- Starting a chain where each specialist builds on the last - **SAY:** "The [first trade] takes a look first, then the [next trade] builds on what comes back."
- Convening several specialists at once - **SAY:** "Getting the [trade] and [trade] to weigh in on this together."
- A specialist's work has come back and you are folding it in - **SAY:** nothing. Integration is the work, not an event.

Trades, never agent names, files, or slugs: product manager, product lead, designer, delivery lead, architect, architecture reviewer, platform engineer, compliance specialist, security engineer, developer, quality engineer, release engineer, operations engineer. Nothing is said about handing off as a mechanism, briefs, context paths, rule bundles, contribution files, identity markers, blindness between participants, rounds, or which topology the stage declares. The user is meeting colleagues; that setup is ours, not theirs. A topology that does not apply is never mentioned either.

**Who writes what (mirrors a real working session — everyone writes; the owner collates and edits):**

- Each dispatched support agent WRITES its own **contribution file** at `<record>/<phase>/<stage>/contributions/<agent-slug>.md` (per-unit stages: under the unit's stage dir). Separate files per agent, so parallel dispatch never conflicts. Line 1 is the identity marker verbatim: `**Collaborator:** <agent-slug>`. Line 2 is the working-space marker verbatim: `**Working space:** not a stage output; the outputs are <the stage's produces[] paths>.` Then the body follows what the seat writes. A seat that writes pieces of the outputs, as every seat in the `mob` rounds below does, records `## Pieces` (its pieces, each under the heading of the output section it fills, in that output's final shape, citing its evidence). A seat that performs acts, as a `subagent` spoke does, or a `mob` seat whose stage body replaces the rounds with a serial pairing of acts, records `## What I did` (the concrete act performed — commands run, code or tests written, defect planted, path exercised) and `## What that showed` (what the doing revealed). Every seat records `## Positions` (`AGREE:` / `OBJECT:` bullets with one-line rationales; `None` = full agreement). A seat may also create and edit real files under `contributions/<agent-slug>/` — probes, fixtures, failing tests, measurement scripts — and cite them. **A contribution is work performed — pieces written or acts done — never an opinion about work.** An ensemble of assessments is a review board, which `reviewer` + `reviewer_max_iterations` declare (§12a), never a mode. A seat that cannot perform its work says so and says why: that is a finding about the work.
- Contribution files are **working space**. The LEAD alone edits the stage's `produces[]` artifacts, which prevents write races between parallel seats, and owns their final state. Only `produces[]` carries forward: no later stage reads a contribution as a source. A contribution is revised in place each round, so it always holds the seat's current pieces and positions; what changed between rounds is narration, which never goes in a contribution or an artifact. Contribution files stay on disk as the stage's record, so dissent stays on disk, not in ephemeral return text.
- On `pipeline`, the chain collectively authors the artifacts directly (serialized, so no conflict) and the conductor mints a durable link receipt after every return — see the topology bullet.

- **`mode: inline`** — the support agents are perspectives the orchestrator adopts in its own context: load each support agent's file + knowledge the same way you loaded the lead (see "For inline stages" above), produce the lead's output first, then layer in each support perspective, then synthesise. Do NOT dispatch a support agent on an inline stage; dispatch is reserved for the other modes. No contribution files.
- **`mode: subagent`** - hub-and-spoke. Dispatch the lead for the draft. If the stage declares `support_agents`, dispatch each one against the returned draft (artifacts by path per §11's context budget, rules through the harness-declared native preload or verbatim accumulated steering bundle per `stage-protocol.md` § "For subagent stages" step 2; spokes are mutually blind - no support agent's brief contains another's contribution); each spoke writes its contribution file; then dispatch the lead once more to integrate the contributions into the artifacts.
- **`mode: pipeline`** — chain. `directive.pipeline.links` is the declared lead-then-support order; `directive.pipeline.completed` is the current-attempt recovery ledger. On entry or resume, skip every completed entry and dispatch the FIRST missing link. After each link returns, mint its receipt before dispatching the next: `bun {{HARNESS_DIR}}/tools/aidlc-log.ts link --stage "<directive.stage>" --link "<agent>"`. Add `--single` when `directive.single === true`. For a multi-repo stage, run one independent chain per registered repo, add `--repo "<repo>"`, and treat repo-qualified `directive.pipeline.completed` entries (`<repo>:<agent>`) as that chain's recovery state. A current-attempt repo-scoped reuse receipt marks that repo's whole chain completed without dispatch. Each link sees everything upstream and advances the work product directly — it may edit the evolving artifacts in place (serialized, no conflict) or hand results down as context for the next link to build on, per the stage body. The FINAL link leaves the `produces[]` artifacts complete. Order is the point. No contribution files required.
- **`mode: mob`** — mesh: the seats and the lead write the stage's outputs together, in bounded rounds. Each output is split into pieces, and every piece has one author, a support agent or the lead; the stage body, or the contract it names, says which seat writes which piece. A seat researches what its piece needs while writing it. A piece that answers the assembled artifacts — a test of them, or the case against their leaning — is written in the shared round, and a seat with only such pieces joins there.
  - **Round 1.** Dispatch every support agent with a round-1 piece in parallel on the stage's inputs, mutually blind; each writes its pieces into its contribution file. The lead writes its own pieces and assembles every piece into the `produces[]` artifacts. Assembly joins and reconciles: the lead changes another seat's piece only to resolve a conflict between pieces, and names each such change, with its reason, in the stage's completion summary.
  - **Shared round.** Re-dispatch every support agent with the assembled artifacts and every other contribution. Each revises its own pieces in place, writes its shared-round pieces, and records a position on every other piece it has a stake in: `AGREE:`, or `OBJECT:` with evidence. A piece under objection stands only if its author answers the objection with evidence in the revised piece. The lead re-assembles.
  - **Contested round.** If objections remain, re-dispatch only the authors and objectors of the contested pieces, once, and re-assemble. Then TRIAGE what is still unresolved, by kind:
  - **Judgment calls** (both positions legitimate — scope, risk appetite, priority tradeoffs): surface to the HUMAN mid-stage as a structured question per §3 (write it to the stage's questions file with a blank `[Answer]:` tag BEFORE presenting, as §3 requires), then continue integration with the human's ruling. The human is a mob participant, not a post-hoc approver. On a stage whose `directive.approval_mode` is `autonomous`, apply `stage-protocol.md` § "Reserved operator decisions" instead: a call in a stopping class is asked as that section says, or written as a pack and parked on when no person is in the session; a call in a decided class is ruled on by the lead, naming the class; anything else is settled on the stage by the lead from the evidence. The lead records each ruling and the dissent in the artifact and continues. Under autonomous Construction the final-batch gate rule wins over both: every judgment call is recorded in the artifact and audit and surfaces at the final-batch gate, and the action a stopping-class call guards is not taken before it is answered.
  - **Knowledge disputes** (the evidence can settle it): the lead rules from the evidence both sides cited, and records the ruling and the dissent in the artifact.
  - Maintained dissent after triage is quoted verbatim in the completion summary at the gate; under autonomous Construction it is recorded in the artifact and audit and surfaces at the final-batch gate instead of halting; on an autonomous stage it is recorded in the artifact and quoted in the completion summary, and the stage does not halt for it.

On a harness that cannot dispatch in parallel, `subagent` spokes and every `mob` round's dispatches run sequentially with UNCHANGED briefs — each participant sees only what its round grants it, so a sequential round-1 seat never sees a sibling's contribution. The topology's who-sees-what contract is the invariant; concurrency is not. A shared-round seat reads the other contributions as they stand when it runs, so on a sequential harness it may see a sibling's revision from the same round; the contested round settles any objection that leaves open.

On every topology, a reviewer NOT-READY (stage-protocol-reviewer.md §12a step 3) re-invokes the LEAD alone with the findings — the ensemble convenes once; the repair loop is lead-reviewer ping-pong.

**Completion evidence (deterministic).** On a `mob` or `subagent`-with-supports stage, the contribution files are the deterministic, structural completion evidence the engine checks: it refuses gate entry and completion while any support agent in the directive's effective `support_agents` is missing its contribution file or that file lacks its identity-marker first line. A lead-only run (the collaborators switch off, so the effective list is empty) owes no contribution evidence and likewise no pipeline link receipt beyond the lead's own. On `pipeline`, current-attempt `PIPELINE_LINK_COMPLETED` receipts are the evidence: every scanned repo needs every declared link, while a current-attempt repo-scoped `ARTIFACT_REUSED` row with `Decision: keep` exempts that reused repo. Isolated reuse rows and link receipts carry the same `single-stage:<slug>` workflow identity, never satisfy the main workflow, and are accepted only while the complete canonical CodeKB artifact set exists under authoritative regular-file paths and its source scope remains `CURRENT`. A rejection, jump, or later stage start resets the main-workflow evidence. Artifact files alone do not satisfy pipeline evidence. The shared escape hatch is `AIDLC_DISABLE_ENSEMBLE_EVIDENCE=1`, only for recovering a legitimately-run stage whose evidence was lost during upgrade or interruption.

---

## 11. Subagent Return Summary

When a subagent completes its work, it MUST return a structured summary to the orchestrator. This ensures no context is lost between subagent execution and orchestrator continuation.

If the dispatch returns before that summary exists (a harness that runs agents in the background), do not write a shell loop or a sleep. Run `{{INVOKE}} engine orchestrate wait --stage <directive.stage> --for collaborators` after dispatching support agents, or `--for artifacts` after dispatching the lead (add `--unit <directive.unit>` on a per-unit stage), and re-run that same command while it answers `status: waiting`. It returns within its bound and lists exactly what is still missing. `--for collaborators` checks only that each contribution file exists with its identity line, so it settles a mob's round 1 alone: after the shared or contested round, wait for every re-dispatched seat's own return before re-assembling.

### Required return format:
```markdown
## Subagent Summary: [Stage Name]

### Produced
- [file path 1]: [brief description of content]
- [file path 2]: [brief description of content]

### Key Decisions
- [Decision 1]: [rationale]
- [Decision 2]: [rationale]

### Issues / Concerns
- [Any problems encountered, edge cases found, or risks identified]
- "None" if no issues

### Next Steps
- [What the orchestrator should do next based on this output]
```

### Rules:
- The orchestrator MUST read this summary before proceeding to the next stage
- If the "Issues / Concerns" section is non-empty, the orchestrator MUST present them to the user before continuing
- If the "Produced" section lists fewer files than expected for the stage, the orchestrator MUST investigate before marking the stage complete
- The files are the substantive handoff. The return summary names paths,
  decisions, concerns, and the next action only; it does not repeat artifact,
  contribution, scan, source, or test-output bodies that are already on disk.

### Collaborator contribution files (ensemble topologies)

A support agent dispatched on a `subagent` or `mob` stage writes its
contribution file as §5 "Who writes what" defines, and returns the standard
summary above with the file listed under "Produced". Each brief names the
pieces the seat writes (`mob`) or the act it performs (`subagent`); a brief
that asks for an assessment gets an assessment back.

### Context budget for subagent prompts
To prevent context overflow in subagent calls:
- **Current-unit only**: Pass only the design artifacts for the unit being implemented, not all units
- **Summarize inception artifacts**: For CONSTRUCTION subagents, provide a 1-2 line summary of each inception artifact with its file path, rather than embedding full content. The subagent can Read specific files if needed.
- **Always include**: The specific task instructions and relevant state/artifact paths. The harness agent config loads persona and knowledge context; do not paste either into the prompt.
- **Large knowledge sets**: Name any especially relevant file paths in the brief, but let the dispatched agent read them through its configured resources.
- **Files and commands**: Every subagent prompt carries this sentence verbatim: Write and edit files yourself with your file tools, never through the shell (no heredoc, no `echo`, `printf`, or `python3` writing a file, no `sed -i`, no `mkdir`; the file-write tool creates any missing folder). A command the person asks for, or one the plan names (a package install, a build, a scaffolder, a migration, a formatter, a code generator, even a `mkdir`), still runs as written. Read, list, and search (your own knowledge files included) with your file tools where you have them; where the shell is your only way to read, use one plain read command (no `cd` before it, no pipe or second command after it). Run every AI-DLC command exactly as written, as a command of its own (no `cd` before it, no pipe or second command after it), keeping its path as written (never a full path): a shell line can stop and ask the person to approve it.

### Subagent failure recovery
If a Task tool call fails (timeout, error, or returns truncated/incomplete output):
1. **Retry once** with a reduced context prompt — summarize inception-phase artifacts instead of including full content, pass only the current unit's design artifacts
2. If the retry also fails, **tell the user plainly what failed** and offer two options via a structured question:
   - "Run it here": do the stage's work in this conversation instead of handing it off; slower, but it sidesteps whatever is failing
   - "Skip and revisit": leave the stage unfinished, keep going, and come back to it later
3. Record the failure and resolution with `{{INVOKE}} engine audit append-raw "Error: <brief>" "<body>"` (the audit trail rules in section 4)

---

---

## Harness topology bindings

### Claude Code

`directive.mode` selects the topology, and §5 is its contract. On Claude Code: dispatch with a `Task` call to the named agent, which loads its persona automatically — never inject it in the prompt. Dispatches in one round go as parallel `Task` calls in one message. Briefs carry artifacts by path and rules per `stage-protocol.md` § "For subagent stages" step 2. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file.

---

### Kiro CLI

`directive.mode` selects the topology, and §5 is its contract. On Kiro CLI: delegate with the `subagent` tool to the named agent config, which loads its own persona — never inject it in the prompt. Dispatches in one round go as parallel tasks in one delegation where possible. Briefs carry artifacts by path, with rule delivery through the registered agent's native preload per `stage-protocol.md` § "For subagent stages" step 2. Every delegation target needs an agent config in `{{HARNESS_DIR}}/agents/` and a `trustedAgents` entry in the conductor's config. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.

---

### Kiro IDE

`directive.mode` selects the topology, and §5 is its contract. On Kiro IDE: delegate with the `subagent` tool to the named Markdown agent, which loads its own persona — never inject it in the prompt. Dispatches in one round go as parallel tasks in one delegation where possible. Briefs carry artifacts by path and rules per `stage-protocol.md` § "For subagent stages" step 2. Kiro IDE resolves each persona directly from its `{{HARNESS_DIR}}/agents/*-agent.md` file, which carries a non-empty `tools:` grant and capability-scoped `permissions.rules`, with no agent-v1 JSON or conductor `trustedAgents` entry. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.

---

### Codex CLI

`directive.mode` selects the topology, and §5 is its contract. On Codex CLI: spawn the named agent role — the harness resolves `{{HARNESS_DIR}}/agents/<agent>.toml`, which loads its own persona via `developer_instructions`; never inject it in the prompt. Spawns in one round may run sequentially on this harness; the who-sees-what contract in §5 still holds. Briefs carry artifacts by path and rules per `stage-protocol.md` § "For subagent stages" step 2. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.

---

### Cursor

`directive.mode` selects the topology, and §5 is its contract. On Cursor: dispatch with the `task` tool to the named agent, which loads its persona automatically — never inject it in the task. Dispatches in one round go as parallel tasks in one turn, with paths-only briefs. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.

---

### opencode

`directive.mode` selects the topology, and §5 is its contract. On opencode: dispatch with the `task` tool to the named agent, which loads its persona automatically — never inject it in the task. Dispatches in one round go as parallel tasks in one turn. Briefs carry artifacts by path and rules per `stage-protocol.md` § "For subagent stages" step 2. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.

---

### GitHub Copilot

`directive.mode` selects the topology, and §5 is its contract. On GitHub Copilot: delegate to the named custom agent, which loads its persona automatically — never inject it in the brief. Dispatches in one round go as parallel delegations in one turn. Briefs carry artifacts by path and rules as the accumulated `load-steering` bundle, per `stage-protocol.md` § "For subagent stages" step 2. An `inline` stage runs in this session with the lead agent's persona loaded from its `.md` file under `{{HARNESS_DIR}}/agents/`.
