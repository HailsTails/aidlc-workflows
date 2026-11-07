# CD-33: Sensitive types brand-redact unconditionally

## Rule

A value whose type is branded sensitive redacts unconditionally wherever it surfaces — logs, errors, serialisation — with no opt-out. Branding sensitivity into the type means the redaction travels with the value by construction, rather than depending on every call site remembering to hide it.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-33#sensitive-brands` | review | sensitive branded types redact everywhere, with no opt-out |

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
