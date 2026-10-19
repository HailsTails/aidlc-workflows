# CD-15: Iteration is functional transformation, never an imperative loop

## Rule

Iteration is a transformation, expressed with `map`, `reduce`, `flatMap`, `filter`, or `Array.from` — so it reads as data flowing through a pipeline rather than as mutable imperative stepping. Pure side-effect iteration (logging, registering listeners) uses `forEach` with a callback that returns void. The two imperative shapes this rule replaces are element iteration (`for…of`) and counted iteration (`for (let i = 0; …; i++)`): the first becomes a functional traversal, and the second becomes `Array.from({ length }, mapper)` where the index is derived from position rather than incremented by a manual counter that can drift out of bounds.

**Async stream consumption is iteration this rule does not reach.** Draining an `AsyncIterable` — pulling `await iterator.next()` until exhaustion, or the `for await…of` that desugars to it — is permitted at sites declared as authorised locations for CD-15. The functional forms cannot express it: `map`/`reduce`/`flatMap` over an `AsyncIterable` require materialising the whole stream, which destroys the bounded-residency property that streaming exists to provide. This is a structural fact about the language, not debt — a drain loop at a declared site is fully compliant, carries no paydown obligation, and takes an authorised-location entry, never a carve-out. Everything the rule does reach still binds inside such a loop: the body is a transformation, accumulator updates are whole-value replacements rather than in-place mutation, and synchronous iteration over materialised collections stays functional.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-15#loops` | audit | `for...of`, `for await`, counted `for` and `while` loops |

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Lines matching `for (... of ...)` (with or without `await`), `for (init; test; step)` and `while (`. This includes `do...while`. Each kind is reported once per line.
- Matching is on raw lines, so loop headers split over several lines are missed and the same text inside a string is flagged. Comment lines are ignored.
- The source rule names element and counted iteration; the check also flags `while`.
- Draining an `AsyncIterable` with `for await` is allowed by the rule at declared sites; record it as an `authorised-location`.

## Example violation
```ts
for (const order of orders) {
  totals.push(order.total);
}
```

## How to fix
```ts
const totals = orders.map((order) => order.total);
```
Replace a counted loop with `Array.from({ length }, (_, position) => ...)`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file drains an async stream and cannot use a functional form. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-15#loops", "file": "src/streams/drain.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
