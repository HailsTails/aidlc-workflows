# CD-29: Component/integration tests are the minimum, not the bulk

## Rule

Integration tests are the thin layer of the pyramid, not its bulk: many unit tests at the base, few component tests in the middle, a thin smoke layer on top. Inverting the pyramid — leaning on slow, broad integration tests to catch what unit tests should — is forbidden.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-29#test-pyramid` | review | unit tests form the bulk and component or integration tests stay few |

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
