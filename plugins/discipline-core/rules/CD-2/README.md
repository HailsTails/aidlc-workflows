# CD-2: Closed enumerated list of permitted cast sites

## Rule

A type assertion tells the compiler the value is something the compiler cannot see — it is a claim the type system can no longer check. Casting is therefore permitted only at a closed, enumerated list of sites where an external boundary genuinely forces it (library-introspection and raw-row narrowing shapes the project names explicitly). Everywhere else a cast is a design smell: the type is wrong, so fix the type rather than assert over it. Adding a site to the permitted list is a deliberate, recorded amendment, not an inline decision.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-2#cast-expressions` | audit | a type assertion that is not on the permitted list |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- Every `x as T` and `<T>x` assertion except the permitted forms. Assertions that CD-1 reports (`any`) are not repeated here.
- Permitted: `as unknown`, `as const`, `as <name>` where the name is imported by name from `zod` (including `zod/...`), `<expr>.value as Array<...>` or `ReadonlyArray<...>`, and `as Tool["inputSchema"]`.
- The permitted list is fixed in the check and is not configurable. Further sites are handled as exceptions.

## Example violation
```ts
const user = response as User;
```

## How to fix
```ts
const user = userSchema.parse(response);
```
Parse or narrow the value so the type follows from a check rather than from an assertion.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file sits on an external boundary that forces an assertion, such as an adapter. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-2#cast-expressions", "file": "src/adapters/row-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. The one exception is a record imported from an earlier system, which carries `provenance` instead. [The exceptions format](../../README.md#discipline-exceptionsjson) gives both shapes.
