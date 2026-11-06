# Rin development dependencies at the upstream rebaseline

The repository is the development and packaging environment. Its dependencies
are not a requirement for a consuming project to install npm packages. A
portable installed payload must carry its own runtime and declaration closure
through the retained projection owner. A successful source package is not that
proof.

## Declared owners

The additive Rin source snapshot was placed on upstream `70257f7e` without the
fork's root development dependencies. Restore only the dependencies directly
used by that source and its existing tests:

| Dependency | Pin | Consumer | Existing pin owner |
| --- | --- | --- | --- |
| `jsonc-parser` | `3.3.1` | Harness configuration and strict-tsconfig audit | Fork root and `plugins/discipline-core/package.json` |
| `zod` | `4.4.3` | Rin runtime validation | Fork root and discipline-core |
| `vitest` | `4.1.11` | Rin's authored tests and test configuration | Fork root and discipline-core |
| `@typescript-eslint/parser` | `8.71.2` | Rin's CD14 ESLint rule tests | Fork root and discipline-core |
| `eslint-9` | `npm:eslint@9.39.5` | ESLint 9 compatibility fixture | Fork root and discipline-core |
| `@typescript-eslint/eslint-plugin` | `8.71.2` | Native TypeScript rules exercised by the compatibility suite | Fork root and discipline-core |

The original fork pin is
[`d062c81e5678c9f92162542b425b8a5f095e46e1`](https://github.com/HailsTails/aidlc-workflows/tree/d062c81e5678c9f92162542b425b8a5f095e46e1).
All six pins are declared in that exact fork root manifest. The current
active checkout's manifest is not substituted for that immutable source.
Zod happened to resolve through upstream's SDK dependency tree, which is not a
replacement for declaring Rin's own dependency.

Existing upstream dependency versions and the `proxy-addr` override remain
unchanged. The first four pins preserved all 193 existing lock records and
added 78 records, including optional platform variants; Windows installed
53 applicable packages. The compatibility alias added another 36 applicable
packages and leaves 312 total lock records. Bun moved the unchanged
`@keyv/bigmap` and Keyv 5 records under their existing cacheable dependents to
accommodate Keyv 4 for ESLint 9. Every previous package version and integrity
record remains present. Both the default `eslint` package and command remain
10.11.0; only the named alias resolves 9.39.5. Adding the declared TypeScript
ESLint plugin installed five more applicable packages and leaves 318 lock
records. It hoisted Ignore 7 while preserving the unchanged Ignore 5 artifact
under its existing ESLint dependents. All prior package artifacts remain.

ESLint 9.39.5 is deprecated and unsupported. It is deliberately pinned solely
for backward-compatibility tests, not selected as the framework's default.
Install scripts were disabled; no global, active-project or consumer
installation was changed.

## Type diagnostics and fixture ownership

The unchanged source typecheck initially reported 352 diagnostics:

- 337 in authored Rin tests;
- 13 in audit test inputs;
- 2 in production source, both unresolved `jsonc-parser` imports.

A controlled no-emit check kept the identical file set and borrowed only the
existing fork's Vitest and JSONC declarations. It left four diagnostics.
This accounts for 348 errors as missing declarations and their downstream
inference/assertion-narrowing failures, not 348 separate upstream API changes.

After the declared dependency installation, the normal source typecheck leaves
three diagnostics, all deliberately invalid audit inputs:

- `tools/test-fixtures/audit/violating-banned-import/imports-winston.ts` imports
  the prohibited logger tested by `constitution-audit/audit-constitution.test.ts`.
- `tools/test-fixtures/cd19-imports/scripts/build.ts` imports `pino` as a scope
  probe for `rin-harness-cd19-import-scope.test.ts`.
- `tools/test-fixtures/cd19-imports/src/forms.ts` contains a CommonJS import
  assignment to exercise import-form recognition, not executable ESM source.

Those files remain in the source typecheck. Neither compiler exclusions nor
suppressions were added, and the fixture-only loggers were not installed.
The fixture owners must be kept visible when a later change separates source
compilation from audit-input testing. This check is still a failure, not a full
green repository result.

Restoring the separately approved `eslint-9` alias removes the three unresolved
alias diagnostics from the test typecheck, which now passes. Adapter
typechecking also passes. The focused Rin checks pass 126 cases, including
the deliberate negative-fixture regressions.

The actual ESLint 9 compatibility/configuration-lookup run initially passed
17 cases and failed seven because the native-rules adapter's declared
`@typescript-eslint/eslint-plugin` was absent. After that dependency was
separately approved and restored at 8.71.2, all 24 cases pass. The 126 Rin
checks also pass again on that final dependency set. This proves the exercised
compatibility cases, not discipline-core's full independent installation proof.

The source compiler's upstream `plugins/*/tools/**/*.ts` root pattern is also
not whole-plugin coverage. A broad inventory identifies another 369 potential
roots, including 76 Rin hook files and most of discipline-core. Some can be
reached by imports, so root counts alone are not diagnostic coverage. Native
hook validation and discipline-core's own checks remain separate obligations.

## Independence from stage autonomy

This dependency repair changes only the development manifest, lock and this
account. It introduces no `approval_mode` imports, hooks, schema fields,
presence observation, human-message authority, receipt handling or workflow
transition behavior. It can be applied without the optional stage-participation
commit `3b5156468f80140613cc18640d7b59b0ce3a6c2f`.

General completion-command contracts, plugin runtime closure and hook
registration must retain independently passing fixtures using ordinary upstream
human-participation stages. Rin's seven opted-in stage definitions need the
optional capability when included; their presence must never silently activate
it in a generic core contribution.

Omitting the participation commit retains upstream's existing Construction
policy and sensor bodies. The commit adapts the existing gate-participation
predicates; it does not contain a separate sensor implementation to preserve
through an undocumented dependency.

## Verification boundary

Use the declared lock for development installation. Existing Rin tests are
configured by `vitest.rin.config.ts`. On the checked Windows Node runtime they
run with `--experimental-transform-types` and Vitest's `--configLoader runner`.
These are process-local options, not global settings.

Scoped acceptance covers harness configuration, JSONC parsing, strict-tsconfig
audit, the CD14 parser adapter, audit discipline and negative-import fixtures.
It does not establish a full Rin suite, complete governance coverage, native
hook registration, installed dependency closure, a fresh guarded workflow,
legacy migration, publication or live adoption.
