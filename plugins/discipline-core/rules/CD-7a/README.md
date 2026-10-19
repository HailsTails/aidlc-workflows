# CD-7a: No ReturnType<typeof X> for our own codebase

## Rule

Every type the code produces is named and exported, and callers use that named type. Deriving a type from a factory's inferred return couples the type to the implementation, hides it from find-usages, and breaks the moment the factory's internals shift. The single carve-out is an external library symbol whose package exports no named return type.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-7a#factory-return-types` | audit | a line containing `ReturnType<typeof` |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Any line matching `ReturnType<typeof`, one finding per line. This includes `Awaited<ReturnType<typeof ...>>` and matches inside strings.
- Lines starting with `//`, `/*` or `*` are ignored. A `ReturnType<` and `typeof` split across lines are not seen.
- The source rule's carve-out, an external library symbol with no exported return type, is not detected; record it as an exception.

## Example violation
```ts
type Client = ReturnType<typeof createClient>;
```

## How to fix
```ts
export type Client = { readonly send: (message: string) => void };
const createClient = (): Client => ({ send: () => undefined });
```
Declare and export the type, then annotate the factory with it.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when the type comes from a library whose package exports no named return type. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-7a#factory-return-types", "file": "src/adapters/vendor-client.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
