# Gate artefact shape — three surfaces

Every gate artefact is three surfaces with different jobs, different write rules, and different enforcement. Conflating them is what produces additive correction, restatement, and the review rounds that follow.

| Surface | File | Content | Write rule | Enforced |
|---|---|---|---|---|
| **Facts** | `facts.md` | every measured claim, one atomic row each | a correction **replaces** the row's value and records `corrected-by` | mechanically (`check-artefact-facts`) |
| **Memory** | `<phase>/<stage>/memory.md` | how the facts were found, what was withdrawn, what was wrong | **append only**, timestamped | not enforced — this is the escape valve |
| **Prose** | the gate's produced document | reasoning over the facts that reaches conclusions | references fact keys; states **no figure of its own** | mechanically (`check-artefact-prose`) |

## Why the split exists

A document that carries its own change history **forces** additive correction: deleting a claim would erase the record of having held it, so the author appends a correction beside it instead. The reviewer cites one site, the fix closes one site, and the next round finds a sibling.

Once the history has a home of its own, a correction becomes a **replacement** — and replacement is what makes a fix comprehensive rather than narrow. The facts table then makes each claim single-sited by construction, so a refutation is a one-row edit rather than an N-place sweep.


## What is enforced, and what is not

**Mechanical** (cheap, no judgement, precise failure):

- Every fact key is defined exactly once, in numeric order, and every reference resolves.
- No fact row is orphaned (defined but never referenced).
- Prose carries no bare figure outside fact rows, beyond a small allowlist (dates, record slugs, section and gate numbers).

**Advisory / judgement** (left to the review board, because a script cannot do it):

- Whether a fact is **true**.
- Whether the prose **reasons well** over the facts.
- Whether the id set **carves the facts at the right joints** — one fact split across two rows passes every mechanical check.

The division is deliberate: board rounds are worth their cost on judgement and are pure waste on bookkeeping, so the bookkeeping is mechanised and the judgement is not.

## Templates

- [`facts.template.md`](facts.template.md) — the keyed facts table, with schema and worked rows.
- [`prose.template.md`](prose.template.md) — the reasoning document that references keys only.
- Memory uses the existing `aidlc-shared/memory-template.md`; this directory adds only the rule that it is the **sole** home for discovery narration.

## Adoption order — this matters more than the checks

1. **Template first.** Make the compliant path the path of least resistance: a lane fills a row because the row is already there.
2. **Checks advisory second.** Run them as sensors to size the real false-positive rate on live artefacts.
3. **Blocking third**, once that rate is known.

Introducing a blocking check before the template exists inverts the order and manufactures exactly the friction this shape is meant to remove.
