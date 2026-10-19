# CD-12: Repositories are the primary storage abstraction

## Rule

Storage sits behind a repository port. Domain code talks to the port; an adapter composes the raw storage-driver primitives behind it. The domain never imports the storage driver or a filesystem primitive directly — so the storage technology can change without the domain knowing.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-12#repository-ports` | review | storage sits behind a repository port and domain code never imports a storage driver |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
