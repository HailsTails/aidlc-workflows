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
| `deployCommand` | deploys the target; total and idempotent |

`authorIdentity !== reviewerIdentity` is **validated at load, not advised**. The review gate's integrity rests on the forge forbidding an actor from approving its own pull request; setting both alike produces a bot approving its own work with no error and no visible symptom. A failure invisible by construction cannot be checked advisorily.

### 2. Your own rules — `project.md`

The plugin ships rules that apply to **any** TypeScript project. Rules that apply only to yours go in your space's `memory/project.md`, which is loaded into every session's rule context.

What belongs there: your way of working, your testing posture, your deployment procedure, your resource budgets, your naming conventions — anything true of your project and not of TypeScript projects generally.

What does **not** belong there: rule text copied from this plugin. Cite the rule; do not restate it. A copy drifts.

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
