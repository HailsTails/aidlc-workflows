# CD-27: Tests are zero-everything — zero logic, zero branches, zero unpredictability

## Rule

Test bodies are zero-logic straight lines: no branching, no loops, no try, no ternary, no computed expectations — just arrange, act, assert against hardcoded values. Logic in a test is untested code testing code; variability is faked and pinned, never accommodated with a conditional.

The sections below describe what the audit and ESLint checks cover.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-27#test-body-logic` | audit | branching, `let`, and computing methods in a test file |
| `CD-27#focused-tests` | eslint | `.only` on a test or suite, or `fdescribe`, `fit`, `ftest`, `fsuite` |
| `CD-27#skipped-tests` | eslint | `.skip` or `.fixme` on a test or suite, or `xdescribe`, `xit`, `xtest`, `xsuite` |

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `if` statements, `try` statements, ternary expressions and `let` declarations.
- Any method call with a computing or mutating name, on any receiver: `map`, `filter`, `reduce`, `find`, `forEach`, `join`, `slice`, `split`, `replace`, `includes`, `sort`, `trim`, `keys`, `values`, `push`, `pop`, `splice`, `fill` and similar string and array methods.
- Loops are not flagged here; CD-15 covers them. `throw` is CD-10.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-27/README.md).
- `discipline-cd27/focused-tests` flags `.only` on a `describe`, `it`, `test` or `suite` chain, including `.only.each` and `test.describe.only`, and the bare names `fdescribe`, `fit`, `ftest` and `fsuite`. It reports at the `only` token.
- `discipline-cd27/skipped-tests` flags `.skip` and `.fixme` on those chains, and the bare names `xdescribe`, `xit`, `xtest` and `xsuite`.
- Not flagged: `.todo`, `.concurrent` and `.each`.

## Example violation
```ts
const expected = rows.map((row) => row.id);
```

## How to fix
```ts
expect(ids).toEqual(["a1", "b2"]);
```
Write the expected value out. A method call in the act step is flagged too, so move such logic into the unit under test.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs logic. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-27#test-body-logic", "file": "src/legacy/report.test.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
