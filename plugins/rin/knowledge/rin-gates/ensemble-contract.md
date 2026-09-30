# rin ensemble contract — collaborators contribute, they do not review

Binding on every rin-gates stage declaring `mode: mob`. It refines the upstream `stage-protocol-ensemble.md` for this repo; where upstream is silent this adds, and where upstream sets a boundary (the lead alone edits `produces[]`) that boundary holds.

## The rule

**A mob collaborator's output is work, not an opinion about work.** A seat that only read the draft and formed a judgement has not contributed — it has reviewed, and review is the gate's reviewer and roster, never a seat.

Every seat is dispatched with a brief naming the concrete act it performs on this stage. A brief asking for an assessment gets an assessment back, which is the failure this contract exists to stop.

## What a seat DOES, by gate

| gate | seat | the act it performs |
|---|---|---|
| Gate 1 framing | architect | draft the alternative framing and say what it would cost |
| | developer | attempt the smallest implementation against the framing; report where it does not fit |
| Gate 2 solution options | developer | probe the riskiest premise while options are cheap; report what the probe showed |
| | quality | write the acceptance tests the leading and the challenged candidate imply; report which of the two cannot satisfy one |
| | challenger | build the strongest case, with evidence it gathered, for the candidate the lead is leaning against; state what would have to be true for it to win |
| Gate 3 detailed solution design | developer | implement one caller against the proposed lock |
| | quality | plant a violation the lock claims to forbid and confirm it is caught |
| Gate 4 implement | quality | run the suite under real contention; plant the defect each new check claims to catch |
| | developer | exercise the live path rather than the unit boundary |
| Gate 6 operate | pipeline-deploy | force the deploy path and read the side effect back |
| | delivery | verify the operational claim from the running system, not the record |

A seat unable to perform its act says so and says why — that is a finding about the work, and it is more useful than a verdict.

## The contribution file

Upstream's identity marker and path are unchanged (`contributions/<agent-slug>.md`, first line `**Collaborator:** <agent-slug>`). rin orders the body so the doing leads:

```markdown
**Collaborator:** <agent-slug>

## What I did
[The act from the brief, performed. Commands run, files touched, what was
planted or exercised. Enough that another seat could repeat it.]

## What that showed
[What the doing revealed — including "it worked as claimed", which is a
result. Measurements carry their derivation.]

## Positions
- AGREE: [aspect endorsed] — [one line]
- OBJECT: [aspect disputed] — [one line]
```

`## Positions` is retained because the objection triage needs it, and it is a **tail**, not the point. A file whose `## What I did` says only that the seat read the draft has not met this contract.

## Write scope

A collaborator may create and edit evidence **inside its own contribution directory** — probes, fixtures, throwaway measurement scripts — and cite it. This is what gives a seat something to author.

The lead alone edits the stage's `produces[]` artefacts. That upstream boundary is not relaxed: it prevents write races between blind parallel seats, and the seat's leverage comes from evidence the lead must integrate rather than from editing the artefact directly.

## Seat selection

- **At least two seats, with distinct disciplinary lenses.** One seat is a two-party critique, which is the reviewer topology wearing a mob's name.
- **No reviewer persona is seated as a collaborator.** `rin-*-reviewer-agent` and `aidlc-architecture-reviewer-agent` belong to the review loop. Seating one here is what turns an ensemble into a second board.
- **Model tier follows the seat, not the gate** — a collaborator that runs and measures is doing worker-shaped work.

## Where review lives

Every gate's review is its declared `reviewer` plus its resolved roster in `review-rosters.json`, bounded by `reviewer_max_iterations` — which the upstream protocol is explicit is **not a mode** and layers on top of any topology. Where the reviewer is the board coordinator, the roster is dispatched as a decorrelated board. Seats never review: a gate convenes contributors for work, and its review runs separately from them.

Whether review boards belong before Gate 5 is a consumer policy decision. This contract describes the configured mechanism without choosing that policy.
