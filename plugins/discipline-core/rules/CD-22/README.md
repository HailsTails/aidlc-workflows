# CD-22: Middleware generic context constraint

## Rule

Middleware carries the context it consumes through a constrained generic that each layer widens, not an open property bag — so a capability the middleware reads from context (time, logging, correlation) is guaranteed present by the type rather than defensively re-checked or defaulted. A middleware that reads a context field but leaves its context generic unbounded is the violation.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-22#middleware-context` | review | middleware reads its context through a constrained generic, not an open property bag |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
