# CD-18: Process-lifecycle operations arrive through an injected port

## Rule

Process-lifecycle side effects — signal handlers, exit, kill, high-resolution timing — are a capability that arrives through an injected port, not reached for ambiently on the runtime's process global. Confining them behind a port makes lifecycle behaviour composable and fakeable in tests, instead of a hidden dependency on the running process.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-18#process-lifecycle-ports` | review | process signals, exit, kill and high-resolution timing arrive through an injected port |

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
