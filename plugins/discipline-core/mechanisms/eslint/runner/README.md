# ESLint runner

The ESLint runner is discipline-core's embedded mechanism: each selected clause runs as an ESLint rule inside the team's own ESLint setup. Its `exceptionPath` is `embedded`. Core hands it the selected clauses, the files to check, the repository's tracked paths and the exception records for this mechanism. The runner lints the files with its own configuration to find hits, reports every native channel in the team's setup that weakens a selected rule, and writes and checks the projection `disciplines.eslint.mjs` that carries the records into the team's own run. Its `projectedKinds` is `["config-override"]`, so a record can cover only that kind.

The native channels, the exception kind each maps to, and how the projection is adopted and checked are in [the guide](../../../docs/adding-a-discipline-or-mechanism.md#embedded-mechanisms).

## Runtime

- Node 22.18.0 or later, which runs the `.ts` modules directly by stripping types.
- `zod`, for the piece settings, the loaded plugin, ESLint's resolved configuration and the files the runner reads.
- `eslint` 10.x. This package pins 10.11.0.
- An ESLint-10-compatible `@typescript-eslint/parser`. This package pins 8.71.2.
- `@eslint/plugin-kit`, for parsing inline configuration comments. This package pins 0.7.3. It is a direct dependency, because a transitive copy does not resolve under strict package managers.

## Files

- `create-eslint-runner.ts` builds the runner from its ports: file text, module loading, paths and ESLint. It implements `run`, `conform` and `project`.
- `eslint-instance.ts` is the wrapping factory for ESLint and `@typescript-eslint/parser`, the only file that imports them. It builds a query instance on the team's own configuration, a governance instance on the runner's configuration only, and `lintSourceCases` for conformance. It also defines the reserved rule `discipline-core/inline-config`.
- `inline-config-parser.ts` is the wrapping factory for `@eslint/plugin-kit`, the only file that imports it.
- `projection.ts` writes `disciplines.eslint.mjs` and compares it with the file on disk.
- `package-script-scanner.ts` finds ESLint invocations in tracked `package.json` scripts, and the options and `--suppressions-location` values they carry.
- `suppressions-scanner.ts` reads suppression entries from `eslint-suppressions.json` files and from files named by `--suppressions-location`.
- `eslint-piece-settings-schema.ts`, `eslint-plugin-schema.ts`, `eslint-config-schema.ts` and `eslint-file-schemas.ts` hold the schemas for a piece's settings, a loaded plugin module, ESLint's resolved configuration, and `package.json` and suppressions files.
- `runner.ts` is the runner core loads, wired to the default ports.
- `piece-type-packages.json` lists the packages a piece may import types from, `["eslint"]`. It is not the runtime list above.
- `test-fixtures/` holds the consumer repositories that `native-exceptions.integration.test.ts` checks on real ESLint.

## Writing a piece

An ESLint piece lives at `mechanisms/eslint/<DisciplineId>/` beside its `piece.json`. Each clause's settings are `{ "pluginNamespace", "pluginModule", "rule" }`. `pluginModule` is a `.ts` path inside the piece folder whose default export is an ESLint plugin, and `rule` must be a key of its `rules`. The rule id is `<pluginNamespace>/<rule>`.

The namespace `discipline-core` is reserved. Two selected clauses may not share a rule id, or a namespace with different plugin modules. A bad setting, a module that fails to load or does not match its schema, or a missing rule makes the run fail as `piece-invalid`.

The rule imports only types from `eslint` and gets everything else from ESLint's rule context. CD-14's piece is the example: `mechanisms/eslint/CD-14/piece.json` and `cd14/cd14.eslint-plugin.ts`.
