# CD-13: Kernel layer boundaries are non-negotiable

## Rule

Dependencies point inward and only inward: the domain depends on nothing, the application layer orchestrates the domain, adapters implement the ports the inner layers declare, and transports are leaves at the edge. An inner layer importing an outer one is the violation — it is what inverts the dependency direction the architecture exists to protect.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-13#layer-boundaries` | review | dependencies point inward and an inner layer never imports an outer one |

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
