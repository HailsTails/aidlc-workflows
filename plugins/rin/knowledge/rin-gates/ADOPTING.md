# Adopting this plugin — what you must supply

This plugin ships a **gated delivery pipeline** and the rules that govern it. It deliberately ships **no facts about any particular project**: not your name, not your deploy target, not your task tracker, not your CI provider, not your incidents.

That is not an omission. A plugin that carried another project's specifics would give you instructions you cannot follow and a history you were not present for. **The specifics are yours to write**, and this file says where each kind goes.

## The one-time setup

### 1. Project identity — the nine values every projected file reads

The plugin's prose is written with tokens, not names. Until you configure them, they resolve to neutral defaults that describe the contract rather than naming a command — you will see `the operator`, `the deployment target`, and `(unconfigured: set projectIdentity.mergeCommand to a command that refuses a merge whose latest review verdict is not APPROVED)`.

Those defaults are **deliberately unusable**: they tell you what a thing must do, so you can supply the thing. Set them in `harness.config.json` under `projectIdentity`:

| Field | What it names |
|---|---|
| `operator` | who decides, and who an escalation is addressed to |
| `authorIdentity` | the identity that authors commits and opens pull requests |
| `reviewerIdentity` | the identity that posts review verdicts — **must differ from `authorIdentity`** |
| `deployTarget` | where the operate gate deploys |
| `backlogStore` | where intake captures live before promotion |
| `mergeCommand` | refuses a merge whose latest review verdict is not APPROVED |
| `reviewCommand` | posts a review verdict under an identity distinct from the authoring identity |
| `prCommand` | opens or updates the pull request for the current branch under the authoring identity |
| `deployCommand` | the invocation used only when the project deployment procedure requires an agent-triggered action |

`authorIdentity !== reviewerIdentity` is **validated at load, not advised**. The review gate's integrity rests on the forge forbidding an actor from approving its own pull request; setting both alike produces a bot approving its own work with no error and no visible symptom. A failure invisible by construction cannot be checked advisorily.

### 2. Your own rules — `project.md`

The plugin ships rules that apply to **any** TypeScript project. Rules that apply only to yours go in your space's `memory/project.md`, which is loaded into every session's rule context.

What belongs there: your way of working, your testing posture, your deployment procedure, your resource budgets, your naming conventions — anything true of your project and not of TypeScript projects generally.

What does **not** belong there: rule text copied from this plugin. Cite the rule; do not restate it. A copy drifts.

### Gate 0: selected work, intake and publication

In the active space's `memory/project.md`, use `## Gate 0` to state the local
reconciliation and publication rule, or point to its authoritative project
procedure. A small local project can say: "Reconcile the selected existing
intent. No intake sweep is assigned. Commit the record locally; no push or PR is
requested." This is a project decision to make explicitly, not an implicit
fallback when a required integration fails. Existing user/reviewer/authority
requirements remain in force.

For a project with intake or scheduled lanes, the same section identifies:

- Which assignments own a whole intake sweep and its snapshot source, cadence,
  inflow window, age alarm and capture disposition procedure. Every assigned
  sweep keeps Gate 0's measurement and totality contract, even if it also
  reconciles an existing intent. Targeted promotion still needs current capture
  evidence, sibling checks and confirmed closure, but is not by itself a sweep.
- Whether each assignment permits local committed recording or requires
  same-run branch push and PR, with worktree rules, author identity, commands,
  destinations, required authority and readback. Retain any existing scheduled
  durable-push obligation. Missing required bindings hold that obligation.

No extra configuration format or backlog lifecycle store is needed. A
`backlogStore` label or the local `configBacklogStore` default is not a working
capture adapter. The status tool measures intake only from an explicit tasks
snapshot; without one it reports UNMEASURED. Local existing-intent reconciliation
does not need an intake adapter or forge command. This never turns a required
integration into an optional one.

Gate 0 records local coherence, intake-sweep health and publication separately.
A local PASS is readiness for the existing review ritual, not a review receipt,
human approval or publication. Autonomous stage approval, where selected, remains
workflow policy; it grants no external authority. The same policy can be used
without adding autonomy capability to upstream core. Do not change open workflow
policy or generated installed stages by hand when adopting this correction.

### Deployment procedure

In the active space's `memory/project.md`, use `## Deployment` to identify your deployment procedure and its repository-relative source path. Keep one authoritative procedure, usually in the project's infrastructure documentation or subsystem knowledge; point to the actual workflow/configuration and recovery runbook instead of copying them into the plugin. Gate 6 reads that procedure before taking an action. An empty section or an unexplained command is not a deployment procedure.

The procedure must identify:

- **Target and currency:** environment, required source revision, build/release identity and serving runtime, and how to observe their relationship. Say whether the lane maintains whole-target currency even without a selected Slice, or verifies a selected release. Define how records-only changes, watched paths and superseded runs affect release selection.
- **Delivery and authority:** the existing pipeline or command, what triggers it, where to observe it, when an agent invocation is necessary, and which actions require an operator decision under the active reserved list. Naming a mechanism does not authorize deployment. Observation must not manufacture an approval or bypass a production hold.
- **Verification:** the serving-release/traffic evidence, required smoke checks, a real-path probe and its expected side effect. An upload or green build is not serving evidence, and a health endpoint alone does not prove the delivered capability. State which probes are permitted and avoid unintended customer or payment effects.
- **Recovery:** the rollback anchor, permitted retry/rollback procedure, uncertainty readback and concurrency rules, and migration/data changes a code rollback cannot undo.
- **Operation:** required monitoring/health signals, any true deployment prerequisites, and where the gate's bookkeeping is recorded. Optional integrations remain separate from engine completion.

For merge-triggered CI/CD, Gate 6 observes and verifies the existing run first. A correctly serving release needs no duplicate deploy. Omit `projectIdentity.deployCommand` when no agent invocation is needed; it resolves to the existing unconfigured placeholder without discarding the other configured identity fields. A present value must still be a non-empty string. An unconfigured `deployCommand` does not block observation of that pipeline; it remains a blocker only for an action that actually requires that invocation. Do not add a shell wrapper merely to satisfy a token. If an invocation is needed, bind it through the existing project configuration and verify the installed instructions agree with the procedure; a configuration edit alone is not proof of projection or execution.

Before adopting a generic Gate 6 update, retain any existing project-specific currency, scope, smoke and recovery requirements in the project's procedure. Validate the procedure pointer and the generated installed stage together. Do not hand-edit generated stage files or silently replace an open workflow's policy. Local procedure fixtures demonstrate the contract, not a live deployment or an adopted consumer update.

### 3. Your own decisions — `knowledge/<subsystem>/`

A decision with a subsystem scope goes in that subsystem's `decisions.md` as a dated entry **with the reasoning**, and `project.md` carries a one-line pointer. One fact, one home; everything else points.

This keeps `project.md` a thin set of cross-cutting rails instead of an accumulating pile of per-subsystem rulings, and it means a session working on one subsystem reads that subsystem's decisions rather than all of them.

### 4. Your own history — nowhere in the plugin

Incidents, measurements, dated rulings, "on <date> a lane did X", counts from past runs, references to specific pull requests or tasks: these are **project bookkeeping**. They belong in your space's knowledge layer or your own records.

They do not belong in plugin files, and this plugin holds none of its own. **History is not instructions.** A rule survives in its own words; when it needs justification, state the *failure mechanism* rather than the event that revealed it — a mechanism is something a reader can check against their own situation, an anecdote is something they must take on trust about a project they have never seen.

### 5. Optional friction reducers

[RECOMMENDED-SETUP.md](RECOMMENDED-SETUP.md) covers the things the plugin cannot install for you because they write to your git config, your repository attributes, or your scripts: **merge drivers for the two AIDLC files that conflict by construction** (audit shards and the intents registry — both append-heavy, both written by every lane), the ignore/commit boundary between authored, recorded and derived files, and per-worktree identity attribution.

All optional. The pipeline runs without them; each removes a specific recurring friction that appears once more than one lane runs concurrently.

## What the plugin does supply

- The seven gates and their sequencing, with each gate's entry conditions, refusals, and produced artefacts.
- The code-discipline rule set, cited by id, written against concepts rather than any codebase.
- The review lenses, each a **method** that loads whatever rules your project ships rather than a fixed rule list.
- The scopes that route work to the right subset of gates.
- The sensors that check discipline mechanically.

Where any of these names an operation you must provide — a merge, a review, a deploy, a worktree — it names it through a token, and §1 is where you bind it.

## The test to apply if you extend this plugin

Before adding anything to the plugin, ask: **does this apply to another TypeScript project, and can it be stated without naming mine?**

- **Yes to both** → it belongs in the plugin, stated generally.
- **Yes to the first, no to the second** → find the token or the general phrasing. If a specific must appear, it is configuration, not content.
- **No to the first** → it belongs in your `project.md`, your subsystem knowledge, or your own records — not here.
