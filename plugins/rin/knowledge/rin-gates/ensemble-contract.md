# rin ensemble contract — which seat writes which piece

Binding on every rin-gates stage declaring `mode: mob`. How a mob runs — the rounds, the contribution file and its working-space marker, who edits the outputs — is `stage-protocol-ensemble.md` §5. This contract adds only what §5 leaves to the stage: which seat writes which piece at each gate, the evidence behind positions, where each objection's disposition is recorded, and how seats are chosen.

## Pieces, by gate

A **round-1** piece is written in parallel, blind, from the gate's inputs. A **shared-round** piece answers the assembled outputs, so it is written once they exist. Each seat's brief names its pieces and the evidence this contract names for its positions.

| gate | seat | round | piece |
|---|---|---|---|
| Gate 1 framing | customer | 1 | the requirements' `## Customer and ordinary use` section |
| | product (lead) | 1 | the requirements, Given/When/Then, the known limits, and the decision questions the ask raises |
| | architect | 1 | the decision questions an alternative framing of the ask raises, each with what that framing would cost |
| | developer | 1 | the decision questions the code raises: where the smallest implementation of the ask does not fit what the ask assumes |
| Gate 2 solution options | architect (lead) | 1 | the decision points, its candidates on each, and the candidate it leans towards |
| | developer | 1 | on each decision point it finds in the requirements, the candidate that reuses the most of what exists, with what a read-only probe of its riskiest premise showed |
| | challenger | 1 | on each decision point it finds in the requirements, one genuinely different candidate, built from evidence it gathered |
| | challenger | shared | the strongest case for the candidate the lead leans against, and what would have to be true for it to win |
| | quality | shared | comparison rows: the acceptance tests the leading and the challenged candidates imply, and which of them cannot satisfy one |
| | customer | shared | comparison rows: each candidate's obligations, and each reason given against a cheaper candidate, weighed against the customer section. A question the section does not answer is answered from the record and measurement in the row that needs it; a requirement that must change routes back to Gate 1, as the stage says |
| Gate 3 detailed solution design | architect (lead) | 1 | the domain model, components, contracts, External reality section and Constitution Check, after the stage's measurement step |
| | developer | 1 | the units of work the chosen candidates imply, and their dependencies |
| Gate 6 operate | operations (lead) | 1 | the health-check report from the deployed system, the operational runbook, and the bookkeeping close |
| | pipeline-deploy | 1 | the deployment log, from running the deploy tool as the stage's Step 1 says, with the deploy path read back |
| | delivery | shared | each operational claim in the assembled health-check report, verified from the running system |

Gate 4's test and build seats pair serially rather than in rounds; the gate's own body defines that pairing.

## Evidence behind positions

In the shared round every seat records a position on each piece it has a stake in (§5). At these gates the contract names the evidence a seat builds for its positions. It builds that evidence in its working space, `contributions/<agent-slug>/`, never in the outputs, and cites it in the position it backs. A caller or a planted violation there is a probe, not the Slice's implementation: Gate 3's refusal of implementation governs its outputs. A seat with no piece at a gate joins at the shared round and writes `None` under `## Pieces`.

- **Gate 1, customer:** a position on every requirement, known limit and question, each weighed against the customer section.
- **Gate 3, developer:** one caller written against each proposed contract, and a position on every contract: `AGREE:` citing the caller that fit it, or `OBJECT:` citing where the caller did not fit.
- **Gate 3, quality:** a planted violation of each refusal the lock claims, and a position on every refusal: `AGREE:` citing the planted violation and the check that caught it, or `OBJECT:` citing the planted violation that was not caught.
- **Gate 3, customer:** a position on each lock clause, safeguard and refusal, and on each case of ordinary use the lock leaves out, each weighed against the customer section.

A contract with no position from the developer seat, or a refusal with no position from the quality seat, is unprobed, never one that held.

## Objection dispositions

Contributions are revised in place (§5), so an objection that a seat withdrew, or that a piece's author conceded, leaves no trace in them. At Gates 1 to 3 the lead therefore records, under an `## Objection dispositions` section of the gate's decision record, one entry for every objection a seat raised in any round, naming the seat, the piece and the objection, with where it stands now and the reason that holds it there:

- `accepted`: the evidence shows the objection right, and the outputs meet it, at the section named;
- `conceded`: the outputs meet it, at the section named, on a call both positions could defend, with the reason the piece's author gave way;
- `rejected`: the outputs stand against it, citing the evidence that answers it;
- `contested`: the outputs carry the ruling on it, at the section named, with the maintained dissent. The ruling is the lead's, or, in a stopping class, {{OPERATOR}}'s answer as `reserved-decisions.md` records it;
- `withdrawn`: the objecting seat no longer holds it, with the reason the seat gave.

The decision record is a declared output of the gate: Gate 1's `rin-framing-questions.md`, Gate 2's `rin-options-questions.md` and Gate 3's `rin-design-questions.md`. An entry is a decision over the outputs, not their change history (`DD-5`): it states where the objection stands and why, never what a piece said before or how the rounds went, which belong in the stage's `memory.md`. A gate where no seat objected writes `None` under the section. The customer lens reads this record for its objection check (`decorrelated-review.md` Step 2).

## Seat selection

- **At least two seats, with distinct disciplinary lenses.** One seat is a two-party critique, which is the reviewer topology wearing a mob's name.
- **No reviewer persona is seated as a collaborator.** `rin-*-reviewer-agent` belongs to the review loop. Seating one here is what turns an ensemble into a second board.
- **Every seat and lead is a rin agent.** A stock persona carries knowledge rin's rules may contradict.
- **Model tier follows the seat, not the gate** — a collaborator that runs and measures is doing worker-shaped work.

## Where review lives

Every gate's review is its declared `reviewer` plus its resolved roster in `review-rosters.json`, bounded by `reviewer_max_iterations`. Where the reviewer is the board coordinator, the roster is dispatched as a decorrelated board. Seats never review.

Gates 1 to 3 require their board, for the reasons `decorrelated-review.md` § "Where it fires in the lifecycle" gives.
