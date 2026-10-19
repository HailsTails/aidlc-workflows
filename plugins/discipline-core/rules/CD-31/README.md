# CD-31: No coverage thresholds

## Rule

Coverage is a diagnostic to read, not a gate to pass. A percentage threshold rewards tests written to move a number; the real floor is the every-file test sibling. Chasing a coverage figure produces assertion-free tests that raise the metric and protect nothing.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-31#no-coverage-thresholds` | review | no percentage coverage threshold gates a run |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
