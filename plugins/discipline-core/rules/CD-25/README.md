# CD-25: Unit tests fake everything outside the unit

## Rule

A unit test fakes everything outside the unit under test, injected through the unit's own seam — no real I/O, no real collaborators. The test exercises exactly one unit's logic, with every dependency a controlled fake, so a failure points at that unit and nowhere else.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-25#dependency-isolation` | audit | `vi.fn(<implementation>)` and `.mockImplementation(...)` |

## What the check flags
- Test files only: `*.test.ts` and `*.test.tsx`. Generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A `vi.fn(...)` call with any argument, and any call to a method named `mockImplementation` (on any receiver, with or without arguments).
- Allowed: `vi.fn()`, `.mockReturnValue(...)`, `.mockResolvedValue(...)`, `.mockReturnValueOnce(...)` and `.mockImplementationOnce(...)`.
- The source rule is wider (no real I/O, no real collaborators). Whether a unit is isolated is left to review.

## Example violation
```ts
const clock = { now: vi.fn(() => 1) };
```

## How to fix
```ts
const clock = { now: vi.fn().mockReturnValue(1) };
```
Return a fixed value. If the fake needs logic, the seam is probably too wide.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a test file legitimately needs a fake with an implementation. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-25#dependency-isolation", "file": "src/testing/fake-port.test.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
