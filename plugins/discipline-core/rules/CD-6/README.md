# CD-6: Meaningful names always — no shorthand, no filler words

## Rule

A name states the concept the value represents, not its shape or its category. Shorthand (single letters, truncations) and filler words (data, info, value, result, manager, handler) force the reader to reconstruct meaning the name should have carried — at every scope, including callback parameters and destructures. The name is the documentation.

The rule above is quoted verbatim from `cd-006-meaningful-names.md` in the rin code-discipline set. The sections below describe what the walker check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-6#identifier-names` | walker | a binding named from a fixed shorthand or filler list |

## What the check flags
- `.ts` and `.tsx` files, including tests; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- The declared name of a variable, a parameter, a named function declaration or a destructured binding, when the whole name is exactly one of these (case-sensitive):
  - shorthand: `c op s cb fn tx e ev acc item k v el arr i j n obj val res req tmp temp`
  - filler: `object obj args arguments details extra extras data info params parameters props payload body value result stuff things misc metadata`
- Allowed: longer names that contain these words (`accountData`), names starting with `_`, property keys and property accesses.
- Other poor names (`manager`, `handler`, vague nouns) are left to review.

## Example violation
```ts
const data = await loadAccount(id);
```

## How to fix
```ts
const account = await loadAccount(id);
```
Name the value for what it is in the domain.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must keep a name fixed by an external contract. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-6#identifier-names", "file": "src/adapters/legacy-feed.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
