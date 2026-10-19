# CD-6: Meaningful names always — no shorthand, no filler words

## Rule

A name states the concept the value represents, not its shape or its category. Shorthand (single letters, truncations) and filler words (data, info, value, result, manager, handler) force the reader to reconstruct meaning the name should have carried — at every scope, including callback parameters and destructures. The name is the documentation.

The sections below describe what the audit and ESLint checks cover.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-6#identifier-names` | audit | a binding named from a fixed shorthand or filler list |
| `CD-6#naming-convention` | eslint | a name that breaks the naming convention for its kind |

Review lens: [naming](../../methods/lenses/naming.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- The declared name of a variable, a parameter, a named function declaration or a destructured binding, when the whole name is exactly one of these (case-sensitive):
  - shorthand: `c op s cb fn tx e ev acc item k v el arr i j n obj val res req tmp temp`
  - filler: `object obj args arguments details extra extras data info params parameters props payload body value result stuff things misc metadata`
- Allowed: longer names that contain these words (`accountData`), names starting with `_`, property keys and property accesses.
- Other poor names (`manager`, `handler`, vague nouns) are left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-6/README.md).
- `discipline-cd6/naming-convention` is typescript-eslint's `naming-convention` with the option list in the piece's `piece.json`.
- Enum members are CONSTANT_CASE. `const` bindings are CONSTANT_CASE, camelCase or PascalCase.
- Object literal properties are camelCase. Type properties are camelCase or PascalCase.
- Other variables, functions and parameters are camelCase or PascalCase; a leading or trailing `_` or `$` is allowed.
- Types are PascalCase. Class members are camelCase, and static ones may also be CONSTANT_CASE.
- Consecutive capitals are allowed (`agentID`, `HTTPServer`).
- Ignored: names that need quotes, destructured bindings, imports and unused bindings whose name starts with `_`.

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
