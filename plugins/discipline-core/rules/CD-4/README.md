# CD-4: Zod at every external boundary

## Rule

Every crossing from the untyped outside world — HTTP, environment, files, database rows, inter-process input — is validated by a schema at the seam and handed inward as plain typed data. The boundary is the one place the program does not yet know the shape of its input; parse it there, once, so everything deeper can trust its types.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-4#boundary-validation` | review | every crossing from the untyped outside world is schema-validated at the seam |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
