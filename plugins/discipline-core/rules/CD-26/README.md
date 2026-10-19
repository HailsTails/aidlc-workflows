# CD-26: No module-mocking — module-mock means DI is wrong

## Rule

Faking happens through the unit's own injected dependencies, never by intercepting the module system. A module-mock is a signal that the dependency injection is wrong: if a unit reaches for a collaborator the test cannot substitute through the signature, the collaborator should have been a port. Fix the seam, don't mock the module.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-26#module-mocking` | audit | calls to `vi.mock` |

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every call spelled `vi.mock(...)`, with or without arguments.
- Not detected: `vi.doMock`, `jest.mock`, `vitest.mock` and `vi["mock"]`. Those are left to review.

## Example violation
```ts
vi.mock("./store.ts");
```

## How to fix
```ts
const subject = createSubject({ store: fakeStore });
```
Pass the collaborator in as a dependency and hand the test a fake.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs to intercept a module. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-26#module-mocking", "file": "src/legacy/payments.test.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
