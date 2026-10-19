# CD-28: Tests assert only what the unit is directly responsible for

## Rule

A test asserts the unit's own direct responsibility — its returned output and the calls it makes to its collaborators — not the transitive internals of those collaborators. Asserting through a dependency couples the test to code the unit does not own and makes it fail for the wrong reasons.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-28#unit-responsibility` | review | a test asserts the unit's output and its direct collaborator calls only |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
