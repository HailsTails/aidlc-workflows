# Discipline core

Discipline core checks a repository against the coding disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Core itself enforces nothing and names no discipline and no mechanism. A discipline (for example CD-14, no authored classes) is data under `rules/`, and a mechanism is a runner under `mechanisms/`; core reaches both only through files and one module contract.

Two mechanisms ship: `walker`, a standalone TypeScript syntax walker, and `eslint`, which runs the clause as an ESLint rule inside the team's own ESLint setup. CD-14's `class-syntax` clause has a piece for each.

Adding a discipline or a mechanism, and the full list of ESLint native channels, are covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

Both commands run TypeScript source directly with Node; there is no build step.

```text
node <install>/core/check/check-command.ts --repo <dir> [--base-revision <rev>]
node <install>/core/check/project-command.ts --repo <dir>
```

`check-command` loads the repository's selection, exceptions, rule sets and pieces; works out which files changed since `--base-revision`; runs each selected mechanism once over the repository's tracked `.ts`, `.tsx`, `.mts` and `.cts` files; applies the exceptions; and prints a plain-text report ending in `verdict: pass` or `verdict: fail`.

| Exit | `check-command` | `project-command` |
| --- | --- | --- |
| `0` | the verdict is `pass` | every projection was written or already current |
| `1` | the verdict is `fail` | not used |
| `2` | an input could not be loaded, or a mechanism failed or returned invalid output | any failure |

A load failure prints one line, `load failure: <kind> <fields>`.

The report lists findings, exempted findings, uncovered clauses, stale, forfeited, unrecorded and doubly-held exceptions, invalid exception records, unmeasured checks and projection problems, each with its count. The verdict is `pass` only when every list except exempted findings is empty.

Without `--base-revision`, core cannot tell which files were touched, so a file carve-out cannot be forfeited; if any file carve-out exists the report lists `forfeiture-unmeasured` and the run fails.

`project-command` writes the native configuration each embedded mechanism needs, and prints `<path> <effect>` per file (`written` or `unchanged`). The walker is standalone and writes nothing, so with only the walker selected the command prints nothing and exits `0`.

## Adopting the ESLint mechanism

With any clause selected for `eslint`, run `project-command`. It writes `disciplines.eslint.mjs` at the repository root: one block per piece enabling its selected rules at `"error"` on `**/*.{ts,tsx,mts,cts}`, then one block per exception record turning the rule `"off"` for that record's file, or everywhere for a clause-wide carve-out. Commit it, and spread its default export last in the repository's flat config:

```js
import disciplines from "./disciplines.eslint.mjs";

export default [
  // the team's own blocks
  ...disciplines,
];
```

This is the only supported way to adopt the rules. On every check, core reads the team's resolved configuration for each checked file and fails the run if the projection is missing (`mechanism-not-run eslint missing`), not in effect (`mechanism-not-run eslint not-included`), or differs from what `project-command` would write now (`eslint out-of-date`). Re-run `project-command` after changing the selection or the exceptions.

A file carve-out stays in the projection after it is forfeited, so the team's own ESLint run keeps ignoring that file; core's check is what fails it, as `forfeited`.

Core's own ESLint run uses only the runner's configuration, with ignores, suppressions and inline configuration off, so nothing in the team's setup can change a finding. Every way the team's setup can weaken a selected rule (a native channel) is reported instead, and only an override that matches an exception record is accepted. The guide has the table.

## disciplines.json

At the repository root. It selects clauses and the mechanism that checks each one.

```json
{
  "version": 1,
  "ruleSets": { "team": "tools/disciplines" },
  "clauses": {
    "CD-14#class-syntax": "eslint",
    "team/TD-1#some-clause": "walker"
  }
}
```

- `ruleSets` names the repository's own rule sets, each a directory relative to the repository root. The name `shared` is reserved for the rule set shipped with core.
- `clauses` maps a clause address to a mechanism id. An address is `[<ruleSet>/]<DisciplineId>#<clauseId>`; no prefix means the shared rule set. The mechanism must be one the clause lists.
- Selecting a clause adopts its discipline. Mechanical clauses of an adopted discipline that are not selected are reported as uncovered, and fail the run.
- A judgement clause cannot be selected; it is enforced by review.

## discipline-exceptions.json

At the repository root; absent means no exceptions. Each entry names a selected clause, and applies to the mechanism that clause is selected for.

```json
{
  "version": 1,
  "exceptions": [
    { "kind": "authorised-location", "clause": "CD-14#class-syntax", "file": "src/adapter.ts", "reason": "..." },
    { "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/legacy.ts", "reason": "...", "whyChain": { } },
    { "kind": "clause-wide-carve-out", "clause": "CD-14#class-syntax", "reason": "...", "whyChain": { } }
  ]
}
```

- An `authorised-location` says the clause does not apply to that file.
- A `file-carve-out` is debt in one file. It is forfeited once the file is touched, and needs a five-step `whyChain` (`whys`, `rootCause`, `owner`).
- A `clause-wide-carve-out` exempts the clause everywhere and needs a `whyChain`.
- Files are exact repository paths, never globs.
- An entry that exempts nothing is stale, a file both authorised and carved for one clause is doubly held, and an entry that cannot be parsed is invalid. Each fails the run.

## Installing

Fetch these paths from a pinned commit of this repository into one install directory, keeping their layout:

- always: `package.json`, `core/` and `test-support/hermetic-git/`
- for each selected clause in the shared rule set: `rules/<DisciplineId>/`, `mechanisms/<MechanismId>/runner/` and `mechanisms/<MechanismId>/<DisciplineId>/`
- for each selected clause in the repository's own rule set: `mechanisms/<MechanismId>/runner/` only, since the discipline and its piece live in that rule set

`package.json` is fetched for its `"type": "module"`. Every runtime file is an ES module, and Node takes a file's module type from the nearest `package.json` above it; without this one, that is the consumer's own, and under `"type": "commonjs"` the check crashes.

Leave out test files (`*.test.ts`), `tests/` folders and `test-fixtures/` folders. The install must not sit under a `node_modules` path, because Node does not strip types there. Nothing core reads or writes is under a harness directory.

`core/` is fetched whole, so it also carries three modules used only by core's own tests of piece imports and install naming: `core/check/piece-import-rules.ts`, `core/check/install-naming.ts` and `core/mechanism-port/piece-type-packages-schema.ts`; nothing loads them at runtime.

With the ESLint mechanism selected, the install must sit at the same path relative to the repository root on every teammate's machine and every CI runner, for example a fixed `.rin/<name>/` inside the repository. The projection `disciplines.eslint.mjs` embeds the relative path from the repository root to each piece's plugin module, and core compares the committed file byte for byte with what `project-command` would write now. An install at a different relative path makes the check report `eslint out-of-date`, and the team's own ESLint run may fail to resolve the plugin import.

Core ships no helper that derives this list from `disciplines.json`; whether it should is an open design decision. For now the list is applied by hand or by the adopter's own script.

## Hermetic Git support

The installed [hermetic Git helper](test-support/hermetic-git/index.ts) supplies `createHermeticGitRepository()` and `hermeticGitEnvironment()`. Creating a repository returns a synchronous `Result`: check `outcome` before using `value`; on `failed`, retain the complete `error`, including the allocated `enclosure` when present. Failed construction does not remove that enclosure automatically.

On a successful repository, call `writeFile({ relativePath, body })`, `run({ arguments })` and `commitAll({ message })` only within the repository you own. Each returns a `Result`; inspect failure before continuing. `commitAll` stops if `git add` fails. Dispose the repository explicitly after use and inspect the Result returned by `dispose()`. Disposal only removes the helper's allocated enclosure. Write paths are trusted authoring input; the helper does not enforce containment or create parent directories.

`hermeticGitEnvironment({ configHome, ambient })` returns the same Result shape. Supply an owned absolute `configHome`; omit `ambient` to take one environment snapshot, or supply explicit ambient data. The helper removes its eleven checkout-binding Git variables, redirects user and system configuration, and supplies fixture identity without changing the caller's environment. The repository factory captures that environment once for all its Git operations.

Use injected ports through `createHermeticGitRepositoryWithPorts()` when testing helper orchestration. A real Git invocation still requires the CD47 condition: Git's own observable behaviour must be the assertion's subject and no fake can establish it. Using the helper does not establish that condition.

## Runtime

- Windows, Linux, macOS or WSL. Core keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them.
- Node 22.18.0 or later, which runs `.ts` source by stripping types (`engines.node` in `package.json`). The team's own ESLint run needs it too, since the projection imports each piece's `.ts` plugin module.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- `zod`, for core.
- The walker adds `typescript`.
- The ESLint mechanism adds the team's `eslint` 10.x, an ESLint-10-compatible `@typescript-eslint/parser`, and `@eslint/plugin-kit`.

The packages must resolve from the install directory.

## Known limits

This is the first release. Its tests cover each supported platform's ordinary paths and drives, and a committed ESLint projection checked out with either LF or CRLF line endings. The cases below are not covered by tests. Some may already work, but none is supported until a consumer needs it and a test is added:

- File and folder names outside ASCII.
- Windows device paths (`\\?\C:\...`).
- Repositories or installs on a network share (`\\server\share\...`).
- Paths rooted without a drive (`\repo`).
- Drive-relative paths (`D:file`).
- A working directory that is deleted or can't be read.
- File names containing a backslash.
- A lone carriage return as a line ending.
- `.d.mts` and `.d.cts` declaration files are not handled separately from other sources.
- Columns reported on lines holding non-ASCII text.
- Lint scripts are read with a simple shell tokenizer, so unusual quoting or a `cd` before `eslint` is not interpreted.
- Team ESLint configs that imitate projection block names, register a second copy of the plugin, or use processors are not exercised.
- A byte-order mark at the start of `disciplines.json` or `discipline-exceptions.json`; save them without one.

## Developing core

This directory builds and tests on its own, using only its own configuration: `package.json` declares the packages the code imports, `tsconfig.json` typechecks it under `strict`, `lint.biome.json` configures the linter, and `vitest.config.ts` runs its tests. Run a script from this directory, or from the repository root with `bun run --cwd plugins/discipline-core <script>`:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `lint` | Biome with `lint.biome.json` |
| `test` | Vitest with `vitest.config.ts` |
| `check` | all three in that order |
| `install-proof` | `node scripts/install-proof.ts`: reads the install path list from § Installing in this README, builds CommonJS consumers in an OS temporary directory outside the working tree, installs the `dependencies` from this package's `package.json` there with `npm`, copies the listed paths into each consumer, and runs both commands under both mechanisms, expecting a fail on a class, a pass once it is removed, and a crash when the installed `package.json` is missing; the temporary directory is removed afterwards |

CI runs `check`, then `install-proof`, and then the fork's constitution audit, `bun run audit:rin`, from the repository root; the audit covers this package.

`fork-wiring.test.ts` reads this repository's CI workflow and harness configuration, so it passes only inside this repository.
