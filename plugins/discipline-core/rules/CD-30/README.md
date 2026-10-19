# CD-30: Integration tests catch composition bugs only

## Rule

An integration test exists to catch composition bugs — wiring, contracts between units — not unit-level logic bugs. If an integration test is the first thing to fail on a logic error, the missing test is a unit test; add it at the base rather than diagnosing through the composed system.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-30#composition-only` | review | an integration test targets the wiring between units, not their logic |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
