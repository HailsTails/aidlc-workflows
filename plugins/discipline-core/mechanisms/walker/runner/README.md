# Walker runner

The walker runner is discipline-core's standalone mechanism for checks that read a project's TypeScript source directly. Core hands it the selected clauses and the files to check; it loads each clause's piece module, parses each file once, visits every node of the syntax tree, and reports a hit wherever a piece's check finds one. It reports no native exceptions: the walker has no suppression format of its own, so its `exceptionPath` is `standalone`.

## Runtime

- Node 22.18.0 or later, which runs the `.ts` modules directly by stripping types.
- `zod`, for the piece settings and for every value a loaded check returns.
- `typescript`, for parsing. Only `typescript-parse.ts` imports it.

## Files

- `walker-check.ts` declares the contract a piece implements, `WalkerCheck<Api, Tree, Node>`, and the parse port the runner walks with, `ParsePort<Api, Tree, Node>`. Both are generic over the syntax tree and name no parser.
- `walker-check-schema.ts` holds the schemas the runner parses a loaded piece with: a clause's settings (`module`, a path inside the piece folder ending `.ts`), the piece module's `check` export, and the values a check returns.
- `create-walker-runner.ts` builds the runner from its ports: file text, module loading, paths and parsing.
- `typescript-parse.ts` binds the parse port to TypeScript. It parses with parent pointers set, so a check can walk a node's ancestors through `node.parent`.
- `runner.ts` is the runner core loads, wired to the default ports.
- `piece-type-packages.json` lists the packages a piece may import types from. It is not the runtime list above.

## Writing a piece

A walker piece lives at `mechanisms/walker/<DisciplineId>/` beside its `piece.json`, whose clause settings name the module, for example `{ "module": "class-syntax.ts" }`. The module exports `check`, typed with `import type { TypeScriptWalkerCheck }` from `typescript-parse.ts`.

A syntax check is offered every node of every file that does not end `.d.ts`, never the tree's root. It receives the node, the tree, TypeScript's own API as `syntaxApi`, the clause's anchor kind as `anchorKind`, and `anchorAt`, which turns a source position into a 1-based line, a 0-based column and the trimmed line text. It returns the anchored snippets it finds. A piece never imports `typescript` at runtime: it calls the API it is handed, so the nodes it inspects and the functions it calls come from one TypeScript instance.

A path check is offered every file path, `.d.ts` files included, without reading the file, and returns `"violates"` or `"conforms"`. A violating path is reported at line 1, column 0, with the path as its snippet.

A check that throws, rejects or returns a value outside its schema makes the run fail as `piece-invalid`.
