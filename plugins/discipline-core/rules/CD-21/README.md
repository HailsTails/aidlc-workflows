# CD-21: Every injected port ships a default production factory

## Rule

A port is not just an interface — it ships its own default production implementation, co-located in the same module. Wiring is then trivial and there is exactly one canonical construction site per capability; production wires the default, tests supply their own fakes. A port with no default factory is an incomplete capability.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-21#default-factories` | review | each injected port ships one default production factory |

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
