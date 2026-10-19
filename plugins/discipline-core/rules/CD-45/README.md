# CD-45: Zod runs exactly once per external-boundary crossing

## Rule

Validation runs exactly once, at the boundary crossing, and yields a plain internal shape the rest of the code trusts by construction — it is never re-run deeper in, and the validation library's types never leak inward. Parse once at the seam, map to a domain shape, and let the inner layers depend on that shape, not on the validator.

The sections below describe how the rule is checked.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-45#parse-once` | review | validation runs once at the boundary and its types do not leak inward |

## How it is checked

Every clause of this discipline is a judgement clause. It cannot be selected in `disciplines.json` and no mechanism checks it; a reviewer applies the rule above. Selecting no clause of this discipline leaves nothing uncovered.
