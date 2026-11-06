# CD-45: Zod runs exactly once per external-boundary crossing

## Rule

Validation runs exactly once, at the boundary crossing, and yields a plain internal shape the rest of the code trusts by construction — it is never re-run deeper in, and the validation library's types never leak inward. Parse once at the seam, map to a domain shape, and let the inner layers depend on that shape, not on the validator.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-45#parse-once` | review | validation runs once at the boundary and its types do not leak inward |

Review lens: [zod-boundary](../../methods/lenses/zod-boundary.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above with its review lens, as [ADOPTING.md](../../ADOPTING.md#9-apply-the-judgement-rules) describes. Selecting no clause of this discipline leaves nothing uncovered.
