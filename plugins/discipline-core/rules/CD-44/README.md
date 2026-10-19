# CD-44: Functions must not mutate fields of parameters they receive

## Rule

A function never mutates the fields of the parameters it receives — no assigning to a parameter's property, no pushing into a parameter's array, no sorting it in place. It returns new data instead. Mutating an input makes the function's effect invisible at the call site and couples the caller to an order of operations it cannot see.

The sections below describe what the audit and ESLint checks cover.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-44#parameter-mutation` | audit | assignment to, deletion from or in-place methods on a parameter's fields |
| `CD-44#parameter-reassignment` | eslint | assigning to, incrementing or destructuring into a parameter itself |

Review lens: [decomposition](../../methods/lenses/decomposition.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Inside a function declaration, function expression, arrow function or method, where the root name is one of its parameters (including destructured and outer-function parameters):
  - `parameter.field = value` and `parameter.a[0].b = value`
  - `delete parameter.field`
  - `parameter.push(...)`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`
- Not detected: reassigning the parameter, `+=` and `++`, `Map.set`, and mutation through an alias (`const copy = input; copy.x = 1`).

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-44/README.md).
- `discipline-cd44/no-param-reassign` is ESLint's `no-param-reassign` with `{ "props": false }`.
- It flags assigning to a parameter, incrementing or decrementing it, and destructuring-assigning into it.
- A parameter's fields are not checked here; the audit's `parameter-mutation` clause covers them.

## Example violation
```ts
const addTotal = (order: Order) => {
  order.total = 10;
};
```

## How to fix
```ts
const withTotal = (order: Order): Order => ({ ...order, total: 10 });
```
Copy before sorting or reversing: `[...items].sort()`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must fill an output object supplied by an external API. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-44#parameter-mutation", "file": "src/adapters/legacy-writer.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
