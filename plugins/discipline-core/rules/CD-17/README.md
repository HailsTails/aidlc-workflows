# CD-17: Clock is the only time source

## Rule

Time is an injected capability, not an ambient global: domain code never calls the runtime's now-primitives directly, it reads the current instant through a clock port. Real time enters through exactly one clock abstraction; tests inject a fake clock and advance it deterministically. Bare time construction anywhere else makes behaviour un-fakeable and non-deterministic.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-17#clock-sources` | audit | `Date.now()` and `new Date` |

Review lens: [di-discipline](../../methods/lenses/di-discipline.md), [test-discipline](../../methods/lenses/test-discipline.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder or file can be left out with `exclude` in disciplines.json.
- Any line containing `Date.now()` or `new Date`, one finding per line. Comments and strings are matched too.
- Other time sources (`performance.now`, timers) are not checked; they are left to review.

## Example violation
```ts
const startedAt = Date.now();
```

## How to fix
```ts
const startedAt = clock.now();
```
Accept a clock as a dependency and read time only through it. The one real implementation lives in an adapter.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` for the file that is the single real clock implementation. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-17#clock-sources", "file": "src/adapters/system-clock.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
