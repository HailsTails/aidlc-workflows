# CD-5: No comments, no JSDoc

## Rule

Code is self-documenting: the names, types, and schemas carry the meaning. A prose comment is almost always there to excuse an unclear name or a convoluted expression — so the fix is to clarify the code, not annotate it. The only permitted annotations are machine-meaningful directives that carry a tracked reference; explanatory comments and doc-comments are not.

The rule above is quoted verbatim from `cd-005-no-comments.md` in the rin code-discipline set. The sections below describe what the walker check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-5#comments-directives` | walker | TODOs, linter directives and `@ts-expect-error` without a tracker |

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- `// TODO` not followed by `(`. Any parenthesised text is accepted, for example `// TODO(spec-42) ...`.
- A comment starting with `biome-ignore`, `eslint-disable`, `eslint-enable`, `eslint-disable-line`, `eslint-disable-next-line`, an `oxlint-` equivalent or `eslint <config>`, unless the comment contains `(spec-<number>)`.
- `// @ts-expect-error` on a line without `(spec-<number>)`.
- TODO and `@ts-expect-error` are matched on raw lines, so the same text inside a string is flagged too.
- Ordinary explanatory comments and JSDoc are not flagged; keeping them out is left to review.

## Example violation
```ts
// biome-ignore lint/style/noNonNullAssertion: legacy
const first = items[0]!;
```

## How to fix
```ts
const first = items[0];
```
Remove the need for the directive. If it must stay, add the tracker: `// biome-ignore lint/style/noNonNullAssertion: legacy (spec-42)`.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file legitimately carries untracked directives, such as generated code. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-5#comments-directives", "file": "src/generated/schema.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
