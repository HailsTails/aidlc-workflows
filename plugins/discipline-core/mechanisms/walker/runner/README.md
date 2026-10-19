# Walker runner

The walker runner is discipline-core's standalone mechanism for checks that read a project's TypeScript source directly. Core hands it the selected clauses and the files to check; it loads each clause's piece module, parses each file once, visits every node of the syntax tree, and reports a hit wherever a piece's check finds one. It reports no native exceptions: the walker has no suppression format of its own, so its `exceptionPath` is `standalone`.

## Runtime

- Node 22.18.0 or later, which runs the `.ts` modules directly by stripping types.
- `zod`, for the piece settings and for every value a loaded check returns.
- `typescript`, for parsing. Only `typescript-parse.ts` imports it.

## Files

- `walker-piece.ts` declares the contract a piece implements, `WalkerPiece`: a `prepare` call that receives the piece's selected clauses, the repository's tracked paths and TypeScript's API, and returns a prepared check with per-file `prepareFile` and a repository-wide `finish`.
- `walker-check-schema.ts` holds the schema for a clause's settings: `module`, a path inside the piece folder ending `.ts`.
- `prepare-walker-pieces.ts` loads each selected module once and prepares it with every selected clause that names it.
- `observe-walker-file.ts` offers one file to every prepared piece, parses it once if any piece asks for syntax, walks it, and collects the hits.
- `create-walker-runner.ts` builds the runner from its ports: file text, module loading, paths and parsing.
- `typescript-parse.ts` binds the parse port to TypeScript. It parses with parent pointers set, so a piece can walk a node's ancestors through `node.parent`.
- `jsonc-parse.ts` parses JSON with comments, for pieces that read configuration such as `tsconfig.json`.
- `runner.ts` is the runner core loads, wired to the default ports.
- `piece-type-packages.json` lists the packages a piece may import types from. It is not the runtime list above.

## Writing a piece

A walker piece lives at `mechanisms/walker/<DisciplineId>/` beside its `piece.json`, whose clause settings name the module, for example `{ "module": "class-syntax.ts" }`. The module exports `check`, typed `WalkerPiece` from `walker-piece.ts`. A piece never imports `typescript` at runtime: it calls the `syntaxApi` it is handed, so the nodes it inspects and the functions it calls come from one TypeScript instance.

The runner offers the piece every tracked path in the repository, and the piece decides per file, without reading it, what to do:

- `skipped`: the file is outside the piece's scope. Every piece filters its own files, for example to `.ts` and `.tsx` sources, test files, or `tsconfig.json`.
- `complete` with hits: the piece decided from the path, or from `readText()`, alone.
- `syntax` with `begin`: the runner parses the file once for all pieces and calls `begin` with the tree and `anchorAt`, which turns a source position into a 1-based line and 0-based column. The returned observers receive `enter` and `leave` for every node, `comment` for every comment, and `finish` returns the file's hits.

After every file, the prepared check's `finish` may return repository-wide hits, each naming its file. Every hit names one of the piece's selected clauses and carries a snippet the piece chooses.

`conform` runs each case of a clause's `discipline.json` as a one-file repository holding only that case.

A piece that throws, or returns a value outside its schema, makes the run fail as `piece-invalid`.
