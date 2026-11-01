# Who decides at a rin gate

A gate's lead and its seats settle the work's questions themselves. A question, or an action the gate would take, reaches {{OPERATOR}} only when it falls in a stopping reserved class, under the rules `stage-protocol.md` § "Reserved operator decisions" sets. This file is how a rin gate applies them, and every gate stage points here rather than restating them.

## The fork test

Before asking anything, name the class on the active list that the question falls in. If no class fits, the item is a problem the gate owns. Settle it from the code, the upstream artefacts, the recorded decisions and the rules. Where several options survive, take the one the analysis favours, and break a genuine tie toward the goal the record states. Record the call, its reason and its source in the gate's artefact, and carry on.

## Which list applies

A project that installs rin may list its own reserved classes in its rule layer (`aidlc/spaces/<space>/memory/project.md`). That list is then the whole set and its own markings govern; the rin classes below, their numbers and their markings do not apply. Only when the project gives no list does a rin gate reserve exactly these:

1. A constitution or rules-layer amendment. Stop before the action.
2. A recut of ratified scope: scope {{OPERATOR}} approved in a recorded decision. Framing inside that scope is not a recut. Stop before the action.
3. Weakening or removing a standing guard or check. Stop before the action. Adding or strengthening one is the gate's own work.
4. A values call: one that no recorded rule, requirement or decision, the code or a measurement settles, after ties are broken toward the recorded goal. A technical choice is never a values call. Decided and recorded.
5. Spending money, or acting under an outside identity or account. Stop before the action.
6. An irreversible action, such as a deploy, deleting or migrating customer data, a destructive git operation or a force-push. The only ones decided in advance are those a gate's stage file names as its own (for example Gate 6's deploy); every other one stops before the action.
7. A fact only {{OPERATOR}} holds that no artefact, record or evidence carries. A fact, never a preference or a judgement. Stop before the action.

## Deciding versus stopping

Every class on the active list carries one marking. A class with no marking stops, and a question that fits any stopping class stops even if it also fits a decided class. Whatever list is active, a preference or judgement never falls in a class for facts {{OPERATOR}} holds; it falls in the class its subject does.

- **Decided and recorded.** {{OPERATOR}} can overturn the call on review, so the gate makes it. It names the class, records the choice with its trade-off and the alternatives it rejected, and continues. The PR that carries the call lists it in its body, with its class and where it is recorded, for {{OPERATOR}}'s sign-off.
- **Stop before the action.** A review after the fact cannot undo it, or the gate cannot know the answer. The gate asks, as below, and takes no step the answer governs until it has one.

A gate's own declared actions follow the active list's marking too. Before taking one, such as Gate 6's deploy, the gate checks it against the list. An action in a stopping class is asked about or parked on, as below, and not taken until it has an answer.

## How a stopping question reaches {{OPERATOR}}

{{OPERATOR}} is present in a session when they have written in it since the stage began and `AIDLC_UNATTENDED` is not `1`. In a session {{OPERATOR}} is present in, ask through the normal question contract, as `stage-protocol.md` § "Reserved operator decisions" says: the stage's own `<slug>-questions.md` with a blank `[Answer]:` tag, and the `log decision` / `log answer` pair around the reply, so the Stop hook holds the turn and the reply is recorded.

Never through the interactive question picker when {{OPERATOR}} is not present, as in a scheduled or dispatched run. Nothing else can see the dialog, and the run blocks on it. The gate writes the question as an actionable pack into its artefact: the question and its class, why no record, code or measurement settles it, the options, the gate's recommendation, what changes with each answer, everything pre-staged up to the one privileged action, and an `Operator answer:` line. Then the gate parks (`bun {{HARNESS_DIR}}/tools/aidlc-orchestrate.ts park`), so the pack rides the PR. Where park is refused, the gate follows `stage-protocol.md`'s rule for that case: the pack is recorded with the action not taken and surfaces at the next human gate. A bare "needs {{OPERATOR}}" is a defect.

On resume, the gate reads its packs first. It moves past a question only once its `Operator answer:` line holds the answer and links to {{OPERATOR}}'s own reply: their PR or issue comment, or their `log answer` record. A comment by any other account, an agent's included, does not count. With {{OPERATOR}} present on resume, the gate asks through the question contract. Otherwise a blank line, or an answer that does not link to {{OPERATOR}}'s own reply, parks the gate again with the pack unchanged. Every gate that resumes on a pack applies this rule, and none restates it.

## Mob judgment calls

On an autonomous gate, the lead rules on a seat objection that both positions can defend. It records the ruling and the maintained dissent in the artefact and continues (`stage-protocol-ensemble.md`, mob triage). An objection in a decided class is ruled on the same way, naming the class. Only an objection in a stopping class follows the path above.

## Gate working records are not interviews

`rin-framing-questions.md` and `rin-options-questions.md` record the decisions the gate settled: each with its answer and source, or `reserved — <class>` with its pack. They are not the stage protocol's question flow. They carry no blank `[Answer]:` tags and no question-count target, and they owe no consolidated summary confirmation, because no rin gate declares `summary_confirmation`. An in-session stopping question goes to the stage's own `<slug>-questions.md`, never into these.
