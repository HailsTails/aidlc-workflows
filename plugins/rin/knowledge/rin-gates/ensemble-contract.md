# rin ensemble contract — which seat writes which piece

Binding on every rin-gates stage declaring `mode: mob`. How a mob runs — the rounds, the contribution file and its working-space marker, who edits the outputs — is `stage-protocol-ensemble.md` §5. This contract adds only what §5 leaves to the stage: which seat writes which piece at each gate, and how seats are chosen.

## Pieces, by gate

A **round-1** piece is written in parallel, blind, from the gate's inputs. A **shared-round** piece answers the assembled outputs, so it is written once they exist. Each seat's brief names its pieces.

| gate | seat | round | piece |
|---|---|---|---|
| Gate 1 framing | customer | 1 | the requirements' `## Customer and ordinary use` section |
| | product (lead) | 1 | the requirements, Given/When/Then, the known limits, and the decision questions the ask raises |
| | architect | 1 | the decision questions an alternative framing raises, each with what that framing would cost |
| | developer | 1 | the decision questions the code raises: where the smallest implementation of the ask does not fit the framing |
| | customer | shared | its position on every requirement, known limit and question |
| Gate 2 solution options | architect (lead) | 1 | the decision points, its candidates on each, and the candidate it leans towards |
| | developer | 1 | on each point, the candidate that reuses the most of what exists, with what a read-only probe of its riskiest premise showed |
| | challenger | 1 | on each point, one genuinely different candidate, built from evidence it gathered |
| | challenger | shared | the strongest case for the candidate the lead leans against, and what would have to be true for it to win |
| | quality | shared | comparison rows: the acceptance tests the leading and the challenged candidates imply, and which of them cannot satisfy one |
| | customer | shared | comparison rows: each candidate's obligations, and each reason given against a cheaper candidate, weighed against the customer section, which it extends for any question it does not answer |
| Gate 3 detailed solution design | architect (lead) | 1 | the domain model, components, contracts, External reality section and Constitution Check, after the stage's measurement step |
| | developer | 1 | the units of work and their dependencies |
| | developer | shared | one caller implemented against each proposed contract, and where it did not fit |
| | quality | shared | for each refusal the lock claims, a planted violation and whether it was caught |
| | customer | shared | its position on each lock clause, safeguard and refusal, and on each case the lock leaves out |
| Gate 6 operate | pipeline-deploy | 1 | the deployment log's record of the deploy path, forced and read back |
| | delivery | 1 | each operational claim in the health-check report, verified from the running system |

Gate 4's test and build seats pair serially rather than in rounds; the gate's own body defines that pairing.

## Seat selection

- **At least two seats, with distinct disciplinary lenses.** One seat is a two-party critique, which is the reviewer topology wearing a mob's name.
- **No reviewer persona is seated as a collaborator.** `rin-*-reviewer-agent` belongs to the review loop. Seating one here is what turns an ensemble into a second board.
- **Every seat and lead is a rin agent.** A stock persona carries knowledge rin's rules may contradict.
- **Model tier follows the seat, not the gate** — a collaborator that runs and measures is doing worker-shaped work.

## Where review lives

Every gate's review is its declared `reviewer` plus its resolved roster in `review-rosters.json`, bounded by `reviewer_max_iterations`. Where the reviewer is the board coordinator, the roster is dispatched as a decorrelated board. Seats never review.

Gates 1 to 3 require their board, for the reasons `decorrelated-review.md` § "Where it fires in the lifecycle" gives.
