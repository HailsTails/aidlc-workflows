# CD-11: Operational error envelopes are plain data, not classes

## Rule

Operational error envelopes are plain, tagged data — constructed by a factory, inspected by a type guard, dispatched by an exhaustive switch on the tag — never authored classes extending the runtime's error type. Data-shaped errors compose, narrow, and serialise; class hierarchies for operational failure do not. The only authored error class is the single startup-invariant one the throw rule permits.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-11#error-envelopes` | review | operational errors are tagged data built by a factory and dispatched on their tag |

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
