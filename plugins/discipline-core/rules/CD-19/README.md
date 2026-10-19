# CD-19: External dependencies confined to wrapping ports at the boundary

## Rule

Every dependency on code the project does not own — a third-party library or the runtime's own standard library alike — is confined to a single wrapping port at the boundary; the rest of the codebase depends on that port, never the vendor or platform surface, runtime or type-only. A dependency swap then touches one file, the vendor's types never leak inward, and each confined capability is nameable and fakeable in tests. There is no inline carve-out: a stdlib call in the middle of business logic is as much a violation as a scattered library import. Opening a new wrapping site for a new dependency is a deliberate, recorded decision.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-19#import-boundaries` | audit | imports of a fixed list of libraries, and any `node:` import |

Review lens: [function-first](../../methods/lenses/function-first.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files, including tests and declaration files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A line with `from "<name>"` for: `eslint winston winston-transport better-sqlite3 pino hono @hono/node-server hono/cors hono/cookie hono/types hono/utils/http-status jose @modelcontextprotocol/sdk zod-to-json-schema uuid`. Type-only imports and matches inside strings are flagged too.
- A `node:` specifier in an import, `export ... from`, `import("node:...")`, `import type`, `import x = require(...)` or `require("node:...")`. Unprefixed `fs` is not detected.
- The source rule covers every third-party dependency; the check covers only the list above. The rest is left to review.

## Example violation
```ts
import { readFileSync } from "node:fs";
import { v4 } from "uuid";
```

## How to fix
```ts
import { createFileReader } from "./file-reader.ts";
import { createIdGenerator } from "./id-generator.ts";
```
Import your own port. Only the wrapping file imports the library.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` for the file that is the wrapping boundary for that dependency. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-19#import-boundaries", "file": "src/adapters/file-reader.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
