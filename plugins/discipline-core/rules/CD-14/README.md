# CD-14: Zero class authoring; classes only at external-library call sites

## Rule

Behaviour is composed from functions and closures, not authored classes — state lives in a factory that closes over it. A class appears only where an external library's API demands `new` at the call site; that instance is created inside the wrapping factory and held internally, never re-exported as a class. The rule is per-declaration, not per-export: even a non-exported authored class is a violation.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-14#class-syntax` | audit or eslint | a class declaration or expression outside ambient code |
| `CD-14#library-construction` | review | library classes are built only in wrapping factories and never re-exported |

## What the check flags
- TypeScript source files; declaration files (`.d.ts`) are skipped. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped by the audit mechanism; any other folder can be left out with `exclude` in disciplines.json. The ESLint piece lints whatever files the team's ESLint run includes.
- Any class declaration, class expression, `abstract class`, nested class, or class inside a runtime `namespace`, reported at the `class` keyword.
- Allowed: `declare class`, classes inside `declare module`, `declare global` or `declare namespace`, and `new Client()` on a class imported from a library.
- `library-construction` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
export class Counter {}
```

## How to fix
```ts
export const createCounter = () => {
  let count = 0;
  return { increment: () => (count += 1) };
};
```
Return an object of functions from a factory that closes over its state.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a class is required, such as an adapter extending a library base class. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-14#class-syntax", "file": "src/adapters/vendor-client.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
