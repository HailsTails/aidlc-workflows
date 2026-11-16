# ESLint runner

The ESLint runner is discipline-core's embedded mechanism: each selected clause runs as an ESLint rule inside the team's own ESLint setup. Its `exceptionPath` is `embedded`. Core hands it the selected clauses, the files to check, the repository's tracked paths and the exception records for this mechanism. The runner lints the files with its own configuration to find hits, reports every native channel in the team's setup that weakens a selected rule, and writes and checks the projection `disciplines.eslint.mjs` that carries the records into the team's own run. Its `projectedKinds` is `["config-override"]`, so a record can cover only that kind.

The native channels, the exception kind each maps to, and how the projection is adopted and checked are in [the guide](../../../docs/adding-a-discipline-or-mechanism.md#embedded-mechanisms).

The check compares the committed projection byte for byte with what the runner would write now. The runner reads the install's `package.json`: when it names a package, the install is a packaged one and the projection imports each piece inside it by package name, `<name>/mechanisms/eslint/...`, which resolves wherever the package is installed. Otherwise the install is a copied folder and the projection imports each piece by its path relative to the repository root, so the copy must sit at the same path relative to the repository root for every teammate and CI runner, for example a fixed `tools/discipline-core/` inside the repository; otherwise the projection reads `out-of-date` and its plugin import may not resolve. A piece outside the install, in the repository's own rule set, is always imported by relative path.

## Runtime

- From source, Node 22.18.0 or later, which runs the `.ts` modules directly by stripping types. The built package is plain JavaScript.
- `zod`, for the piece settings, the loaded plugin, ESLint's resolved configuration and the files the runner reads. A dependency of core.
- `@eslint/plugin-kit`, for parsing inline configuration comments. A dependency of core, pinned at 0.7.3, because a transitive copy does not resolve under strict package managers.
- The repository's own toolchain, as optional peers: `eslint` `^9.12.0 || ^10.0.0`, and `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` `^8.56.0`, the first typescript-eslint release whose peer range accepts both ESLint majors. TypeScript is the parser's own peer, so the runner does not check it. The runner loads them once, when it is loaded, and answers every call with `toolchain-unavailable` naming the first that is missing, cannot load or is out of range, or with `toolchain-shadowed` when one resolves from inside the installed core package, before it loads any piece. The suite runs on four lines: ESLint 9.12.0 and 10.0.0 with typescript-eslint 8.56.0, and ESLint 9.39.5 and 10.11.0 with 8.71.2.

## Files

- `create-eslint-runner.ts` builds the runner from its ports: file text, module loading, paths and ESLint. It implements `run`, `conform` and `project`.
- `eslint-toolchain.ts` loads the toolchain for core's own ESLint run by dynamic imports of `eslint`, `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`, so a missing one becomes a named failure. It first asks where each resolves and fails as `toolchain-shadowed` for a copy inside the installed core package, then checks each version against its range, and hands the loaded `ESLint` class to `eslint-instance.ts`, which builds `createEslint` for that version. Core passes only options every supported release accepts: on ESLint 9 it asks for the nearest-to-file configuration lookup with the flag that release names, `unstable_config_lookup_from_file` before 9.30.0 and `v10_config_lookup_from_file` from 9.30.0, and ESLint 10 looks up that way by default. It never passes `applySuppressions`, which ESLint 9 and 10.0.0 refuse and which 10.11.0 accepts with a default of off.
- `eslint-instance.ts` is the port over a loaded toolchain, and takes only types from `eslint` and `@typescript-eslint/parser`. It builds `createEslint` on the loaded `ESLint` class and maps ESLint's results into the runner's own types. It builds a query instance on the team's own configuration, a governance instance on the runner's configuration only, and `lintSourceCases` for conformance. It also defines the reserved rule `<reservedNamespace>/inline-config`. `reservedNamespace` is the one constant naming core's ESLint namespace, currently `discipline-core` while the tooling's name is provisional; the reserved rule, the governance configuration and the projection's block names all take it from there, so a rename is one edit.
- `inline-config-parser.ts` is the wrapping factory for `@eslint/plugin-kit`, the only file that imports it.
- `native-rules.ts` re-exports the ESLint core rules (`eslintCoreRules`) and the typescript-eslint rules (`typescriptEslintRules`) that pieces reuse. It is the only file that imports them, and it imports `eslint/use-at-your-own-risk` and `@typescript-eslint/eslint-plugin` statically, resolved upward from the install like the toolchain.
- `projection.ts` writes `disciplines.eslint.mjs` and compares it with the file on disk.
- `package-script-scanner.ts` finds ESLint invocations in tracked `package.json` scripts, and the options and `--suppressions-location` values they carry.
- `suppressions-scanner.ts` reads suppression entries from `eslint-suppressions.json` files and from files named by `--suppressions-location`.
- `eslint-piece-settings-schema.ts`, `eslint-plugin-schema.ts`, `eslint-config-schema.ts` and `eslint-file-schemas.ts` hold the schemas for a piece's settings, a loaded plugin module, ESLint's resolved configuration, and `package.json` and suppressions files.
- `runner.ts` is the runner core loads: the default ports, bound to the toolchain loaded from the install's own resolution.
- `piece-type-packages.json` lists the packages a piece may import types from, `["eslint"]`. It is not the runtime list above.
- `test-fixtures/` holds the consumer repositories that `native-exceptions.integration.test.ts` checks on real ESLint.

## Writing a piece

An ESLint piece lives at `mechanisms/eslint/<DisciplineId>/` beside its `piece.json`. Each clause's settings are `{ "pluginNamespace", "pluginModule", "rule" }`. `pluginModule` is a `.ts` or `.js` path inside the piece folder whose default export is an ESLint plugin, and `rule` must be a key of its `rules`. The rule id is `<pluginNamespace>/<rule>`.

A clause's settings may also carry `options`, a JSON array passed to the rule after its severity. The governance run, the conformance run and the projection all enable the rule as `["error", ...options]`; without `options` the rule gets only the severity.

A piece reuses an ESLint core or typescript-eslint rule by re-exporting it from its plugin module through `native-rules.ts`: `eslintCoreRules` for core rules and `typescriptEslintRules` for typescript-eslint rules. A piece does not import `eslint` rules or `@typescript-eslint/eslint-plugin` directly.

Both take the rules to read from as `NativeRuleSources`. A piece that wraps native rules exports `createPlugin(sources)` and builds its default export from `defaultNativeRuleSources`, so a test can hand it the rules of another ESLint or typescript-eslint line. In an install the default sources are the copies that resolve from the repository root: the same copies core's own ESLint run loads. When a package in a monorepo lints with its own, different `eslint`, its run wraps the root's rules, not its own.

The namespace `reservedNamespace` names (currently `discipline-core`) is reserved. Two selected clauses may not share a rule id, or a namespace with different plugin modules. A bad setting, a module that fails to load or does not match its schema, or a missing rule makes the run fail as `piece-invalid`.

The rule imports only types from `eslint` and gets everything else from ESLint's rule context. The guide (`docs/adding-a-discipline-or-mechanism.md`) walks through a shipped piece as the example.
