# CD-7: No categorical filenames or folder names

## Rule

A file or folder is named for the abstraction it holds, not for a category of things. A junk-drawer name (utils, helpers, common, shared, types, misc) signals a missing primitive: the code inside wants a real home named for what it does. Category names accrete unrelated code because anything can be justified into them.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-7#categorical-paths` | audit | a forbidden file name or folder name in a path |

## What the check flags
- `.ts` and `.tsx` files only, judged by path; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- File names, exactly and in lower case, with a `.ts` extension: `types.ts interfaces.ts models.ts enums.ts utils.ts util.ts helpers.ts helper.ts common.ts lib.ts misc.ts shared.ts`.
- Any folder in the path named `utils`, `helpers`, `common`, `lib`, `misc` or `shared`. Each file under such a folder is reported once for the folder.
- Allowed: `account-types.ts`, `Types.ts` and `types.tsx`, which are not exact matches.

## Example violation
```text
src/helpers.ts
src/utils/format-price.ts
```

## How to fix
```text
src/price-formatting.ts
```
Rename the file or folder for what it contains, or split it into files that each hold one thing.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a path name is fixed by a framework or external convention. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-7#categorical-paths", "file": "src/shared/index.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
