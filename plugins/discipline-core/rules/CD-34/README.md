# CD-34: Secrets never enter the repo

## Rule

Secrets live only in the environment or a secrets manager — never in source, never in logs, never in URL query parameters. A committed secret is compromised the moment it lands in history, whatever happens to it later; the repository is not a place a secret can safely exist.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-34#no-repo-secrets` | review | secrets never enter source, history, logs or URLs |

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
