# CD-23: Every unit has a co-located test sibling

## Rule

Every source file ships a test sibling that sits beside it, sharing its name — there are no source files without a test, and no tests in a separate parallel tree. This is the real coverage floor: not a percentage, but the guarantee that every unit has at least one co-located test stating what it is for. Co-location makes the test the unit's visible contract and keeps the two changing together, where a parallel test tree lets them drift apart.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-23#export-test-sibling` | audit | a production file with a runtime export and no `.test` sibling |

Review lens: [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- Production `.ts` and `.tsx` files. Skipped: `*.test.ts(x)`, `.d.ts` and anything under `__tests__`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder or file can be left out with `exclude` in disciplines.json.
- A file with a runtime export (`export const`, `function`, `class`, `enum`, `export default`, or `export { name }`) and no `<name>.test.ts` beside it (`<name>.test.tsx` for `.tsx`). The sibling must be in the repository's file list.
- Allowed: files with only `export type`, `export interface`, `export declare`, type-only named exports or `export * from`, and files with no exports.
- The source rule asks for a test beside every source file; files without runtime exports are left to review.

## Example violation
```ts
export const price = 1;
```
This is `src/price.ts` with no `src/price.test.ts` beside it.

## How to fix
Add `src/price.test.ts` next to the file, with at least one test of its behaviour.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file only wires exports together and has no behaviour of its own to test. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-23#export-test-sibling", "file": "src/index.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
