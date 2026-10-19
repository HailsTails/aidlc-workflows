# CD-8: No default on switch over a closed discriminated union

## Rule

A switch over a closed discriminated union carries no `default:` arm. Exhaustiveness is the type system's job: with no default, adding a variant surfaces as a compile error at every switch that has not handled it. A `default:` swallows that signal and lets the new variant slip through silently at runtime.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-8#switch-defaults` | audit | a `default:` arm inside a `switch` |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line matching `default:` while inside a `switch (`, tracked line by line by counting braces. One finding per line; comment lines are ignored.
- Every `default:` is flagged. The check cannot tell whether the switch is over a closed union, so a switch over an open set (a plain string) needs an exception. Other `default:` text inside a switch, such as an object key, is flagged too.

## Example violation
```ts
switch (event.kind) {
  case "opened": return open();
  default: return ignore();
}
```

## How to fix
```ts
switch (event.kind) {
  case "opened": return open();
  case "closed": return ignore();
}
```
Name each remaining variant so the compiler checks exhaustiveness.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a switch is over an open set of values and needs a fallback. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-8#switch-defaults", "file": "src/parsing/token-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
