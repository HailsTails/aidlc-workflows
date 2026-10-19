# CD-9: All operational failures return Result<T, E>

## Rule

Every expected, operational failure is modelled as data — a result-shaped return carrying a tagged error union that enumerates each way the operation can fail — not raised as an exception. Infrastructure failure is an operational outcome, not an escape into throwing. Callers dispatch on the error as a value, so no failure path is invisible in the type.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-9#result-failures` | review | expected operational failures are returned as a Result with a tagged error union, not thrown |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
