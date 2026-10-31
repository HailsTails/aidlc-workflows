# Who decides at a rin gate

A gate's lead and its seats settle the work's questions themselves. A question reaches {{OPERATOR}} only when it is a reserved operator decision, the closed set `stage-protocol.md` § "Reserved operator decisions" defines. This file is how a rin gate applies that set, and every gate stage points here rather than restating it.

## The fork test

Before asking anything, name the reserved class the question falls in. If no class fits, the item is a problem the gate owns. Settle it from the code, the upstream artefacts, the recorded decisions and the rules. Where several options survive, take the one the analysis favours, and break a genuine tie toward the goal the record states. Record the call, its reason and its source in the gate's artefact, and carry on.

## The rin classes

A project that installs rin may list its own reserved classes in its rule layer (`aidlc/spaces/<space>/memory/project.md`), and that list replaces this one. Otherwise a rin gate reserves exactly these:

1. A constitution or rules-layer amendment.
2. A recut of ratified scope.
3. Weakening a standing guard or check.
4. A values call the rules and recorded decisions do not cover.
5. Spending money, or acting under an outside identity or account.
6. An irreversible action outside the gate's own lane: a deploy, a destructive git operation, a force-push.
7. A fact only {{OPERATOR}} holds that no artefact, record or evidence carries.

## Deciding versus stopping

A reserved class does not always mean waiting.

- **Decide, record, continue: class 4.** {{OPERATOR}} can overturn the call on review, so the gate makes it. It names the class, records the choice with its trade-off and the alternatives it rejected, and continues. {{OPERATOR}} reviews it on the PR.
- **Never do, never propose: class 3, and the money half of class 5.** A guard that over-blocks is corrected with precision, never weakened.
- **Stop before the action: classes 1, 2, 6 and 7, and the identity half of class 5.** A review after the fact cannot undo these, or the gate cannot know the answer.

## How a stopping question reaches {{OPERATOR}}

Never through the interactive question picker in a scheduled or dispatched run. Nothing else can see the dialog, and the run blocks on it. The gate writes the question as an actionable pack into its artefact: why it is {{OPERATOR}}'s, the options, the gate's recommendation, what changes with each answer, and everything pre-staged up to the one privileged action. Then the gate parks (`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts park`), so the pack rides the PR. In a session {{OPERATOR}} is present in, the same pack is plain text at the end of the turn. A bare "needs {{OPERATOR}}" is a defect.

## Mob judgment calls

On an autonomous gate, the lead rules on a seat objection that both positions can defend. It records the ruling and the maintained dissent in the artefact and continues (`stage-protocol-ensemble.md`, mob triage). Only an objection that names a reserved class follows the stopping path above.

## Gate working records are not interviews

`rin-framing-questions.md` and `rin-options-questions.md` record the decisions the gate settled: each with its answer and source, or `reserved — <class>` with its pack. They are not the stage protocol's question flow. They carry no blank `[Answer]:` tags and no question-count target, and they owe no consolidated summary confirmation, because no rin gate declares `summary_confirmation`.
