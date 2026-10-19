# CD-34: Secrets never enter the repo

## Rule

Secrets live only in the environment or a secrets manager — never in source, never in logs, never in URL query parameters. A committed secret is compromised the moment it lands in history, whatever happens to it later; the repository is not a place a secret can safely exist.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-34#no-repo-secrets` | review | secrets never enter source, history, logs or URLs |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
