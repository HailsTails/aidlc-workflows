# CD-40: Single-object-argument functions

## Rule

A function takes a single named-field object argument rather than a positional parameter list, so every call site reads as a labelled contract instead of a sequence of unlabelled values whose meaning depends on order. Named fields also make adding or reordering parameters a safe, non-breaking change.

The sections below describe what the ESLint check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-40#parameter-count` | eslint | a function with more than two parameters |
| `CD-40#named-object-argument` | review | the single argument is an object with named fields, not a positional scalar |

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-40/README.md).
- Rule `discipline-cd40/max-params`, which is typescript-eslint's `max-params` with `{ "max": 2, "countVoidThis": true }`.
- A function declaration, function expression, arrow function, method or constructor with more than two parameters. A `this` parameter counts.
- Allowed: functions with two or fewer parameters.
- `named-object-argument` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
const createOrder = (customerId: string, items: Item[], currency: string) => ({ customerId, items, currency });
```

## How to fix
```ts
const createOrder = ({ customerId, items, currency }: OrderRequest) => ({ customerId, items, currency });
```
Take one object with named fields so each call site reads as a labelled contract.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must implement a callback signature fixed by an external library. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-40#parameter-count", "file": "src/adapters/vendor-callback.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
