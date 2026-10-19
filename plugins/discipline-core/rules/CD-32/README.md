# CD-32: PII strings redact-by-default in structured logs

## Rule

Structured logs redact personally-identifying data by default; a field becomes loggable only by explicitly opting in as safe. Redaction is the default so a new field is never accidentally leaked into logs — safety is the resting state, exposure the deliberate exception.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-32#pii-redaction` | review | structured logs redact PII strings unless a field is explicitly opted in |

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
