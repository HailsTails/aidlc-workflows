# CD-10: Throws permitted in exactly two contexts

## Rule

Throwing is confined to a closed, named set of contexts: a startup-invariant check that fails at boot, and a branch made unreachable by exhaustive type narrowing. Defensive throws — "this should never happen", "guard against impossible state" — are forbidden: if you can name the state, you can model it as a result variant. A library that throws is caught at the boundary and converted to a result. Tests carry no exemption; they surface failures through assertions, not by throwing.

The sections below describe what the audit and ESLint checks cover.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-10#throws-in-tests` | audit | a `throw` statement in a test file |
| `CD-10#throw-only-error` | eslint | a `throw` of something that is not an error object |

Review lens: [errors-as-data](../../methods/lenses/errors-as-data.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. `*.spec.ts` and `.js` tests are not read. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `throw` statement, wherever it sits in the file.
- Allowed: assertion calls such as `expect(...)`.
- The source rule also confines throwing in production code to a closed list of contexts. The check does not look at production files; that part is left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-10/README.md).
- `discipline-cd10/throw-only-error` flags a `throw` of a literal, an object literal, a binary expression, a template or tagged template, or `undefined`. It follows the thrown value through `a ? b : c`, `a || b`, assignment and sequence expressions.
- Allowed: `new Error(...)`, identifiers, calls and member access.
- This clause applies to every file the ESLint run includes, not only tests.

## Example violation
```ts
it("loads the account", () => {
  const result = load("a1");
  if (result.outcome === "failed") throw new Error("load failed");
});
```

## How to fix
```ts
it("loads the account", () => {
  expect(load("a1")).toEqual({ outcome: "ok", value: account });
});
```
Assert on the whole result. Branching in tests is also reported by CD-27.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs a throw, such as a shared test harness. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-10#throws-in-tests", "file": "src/legacy/harness.test.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
