# CD-43: Booleans are evaluative, not declarative

## Rule

A boolean parameter, field, or return is an evaluative predicate the reader must decode at every call site — `true` for what? Prefer a string-literal or discriminated union that states the meaning in the value itself. Booleans that name a state or mode hide that meaning behind a bare truth value.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-43#boolean-signatures` | audit | a boolean type in a parameter, property signature or return |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A declared type of `boolean`, or `boolean` unioned only with `null` and `undefined`, on a parameter, an interface or type-literal property, a function, method, arrow or accessor return, or a function, call or index signature.
- Allowed: `true` or `false` literals, `boolean | string`, aliases of boolean, type predicates such as `value is Item`, inferred types, variables and class fields.
- All boolean signatures are reported, including predicates such as `isReady(): boolean`. Telling evaluative booleans from state is left to review.

## Example violation
```ts
const render = (compact: boolean): string => "";
```

## How to fix
```ts
const render = (mode: "compact" | "full"): string => "";
```
Name each state in the type.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file must follow an external interface that uses a boolean. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-43#boolean-signatures", "file": "src/adapters/vendor-flags.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
