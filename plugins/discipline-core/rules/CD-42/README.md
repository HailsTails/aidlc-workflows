# CD-42: Unhappy paths are early returns; happy path is the final return

## Rule

Unhappy paths are handled first as guard clauses that return early; the happy path is the final, un-nested return at the bottom. There is no `else` after an early return. Guarding first keeps the main path flat and readable, instead of burying it inside nested conditionals.

The sections below describe what the ESLint check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-42#useless-else` | eslint | an `else` after an `if` branch that always exits |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-42/README.md).
- Rule `discipline-cd42/useless-else`: an `else` after an `if` branch that always exits is reported at the `else` keyword.
- A branch always exits when it ends in `return`, `throw`, `continue`, or `break` outside a switch. A nested `if` exits when both of its branches do. A `switch` exits when every non-empty case does.
- Along an `else if` chain whose earlier branches all exit, every `else` is reported.
- Allowed: an `else` after a branch that can fall through.

## Example violation
```ts
const label = (order: Order) => {
  if (order.cancelled) {
    return "cancelled";
  } else {
    return "active";
  }
};
```

## How to fix
```ts
const label = (order: Order) => {
  if (order.cancelled) return "cancelled";
  return "active";
};
```
Handle the unhappy path first with an early return and leave the happy path as the final return.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must keep an else for an external reason. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-42#useless-else", "file": "src/legacy/status.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
