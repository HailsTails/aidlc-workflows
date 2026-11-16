# Discipline core

Discipline core checks a repository against the coding disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Core itself enforces nothing and names no discipline and no mechanism. A discipline (for example CD-14, no authored classes) is data under `rules/`, and a mechanism is a runner under `mechanisms/`; core reaches both only through files and one module contract.

Two mechanisms ship: `audit`, a standalone TypeScript syntax walker, and `eslint`, which runs the clause as an ESLint rule inside the team's own ESLint setup. [rules/README.md](rules/README.md) lists every shared discipline with its clauses: the audit mechanism checks 20 disciplines, and ESLint pieces check clauses of CD-1, CD-6, CD-7, CD-10, CD-14, CD-27, CD-40, CD-41, CD-42 and CD-44. The rest are judgement rules, applied in review with the review methods in [methods/](methods/README.md).

To adopt the core in another repository, follow [ADOPTING.md](ADOPTING.md) step by step. A repository already using the older standalone copy route follows [MIGRATING.md](MIGRATING.md) instead.

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

The report lists the excluded paths, findings, exempted findings, uncovered clauses, stale, forfeited, unrecorded and doubly-held exceptions, invalid exception records, unmeasured checks and projection problems, each with its count. The verdict is `pass` only when every list except the excluded paths and exempted findings is empty.

Without `--base-revision`, core cannot tell which files were touched, so a file carve-out cannot be forfeited; if any file carve-out exists the report lists `forfeiture-unmeasured` and the run fails. For the same reason it cannot tell whether an entry with an earlier-contract why-chain is unchanged; if one exists the report lists `legacy-chain-unmeasured` and the run fails.

`project-command` writes the native configuration each embedded mechanism needs, and prints `<path> <effect>` per file (`written` or `unchanged`). The audit mechanism is standalone and writes nothing, so with only the walker selected the command prints nothing and exits `0`.

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
    "CD-14#static-only-class": "eslint",
    "team/TD-1#some-clause": "audit"
  },
  "exclude": ["tools/discipline-core", "generated"]
}
```

- `ruleSets` names the repository's own rule sets, each a directory relative to the repository root. The name `shared` is reserved for the rule set shipped with core.
- `clauses` maps a clause address to a mechanism id. An address is `[<ruleSet>/]<DisciplineId>#<clauseId>`; no prefix means the shared rule set. The mechanism must be one the clause lists.
- Selecting a clause adopts its discipline. Mechanical clauses of an adopted discipline that are not selected are reported as uncovered, and fail the run.
- A judgement clause cannot be selected; it is enforced by review.
- `eslintConfigLookup`, optional, is `"nearest-to-file"` or `"repository-root"` and says which `eslint.config.*` the team's own ESLint run applies to a file; see [Runtime](#runtime). Leave it out to let core detect it.
- `exclude`, optional, lists repository folders or exact files that no mechanism checks. A folder entry covers everything under it. Globs are refused: an entry containing `*` makes `disciplines.json` malformed. The report lists the active entries under `excluded`. Exclude the core's own install when it is vendored inside the repository.

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
- A `file-carve-out` is debt in one file. It is forfeited once the file is touched.
- A `clause-wide-carve-out` exempts the clause everywhere.
- Every entry needs a `whyChain` that follows the [why-chain contract](docs/why-chain-contract.md): exactly five `{ "why", "because", "evidence" }` steps chained cause to cause, then `rootCause`, `rootCheck`, `readback` and `owner`. The contract lists what core refuses and what review still judges:

  ```json
  "whyChain": {
    "whys": [
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." },
      { "why": "...", "because": "...", "evidence": "..." }
    ],
    "rootCause": "...",
    "rootCheck": "...",
    "readback": "...",
    "owner": "..."
  }
  ```
- A chain with neither `rootCheck` nor `readback` was written to the earlier contract. It is accepted only while the `--base-revision` holds its entry unchanged; a new or edited one is refused as `why-chain-refused`, and a run with such a chain and no `--base-revision` is `legacy-chain-unmeasured`.
- An entry carried over from an earlier system may give `provenance` instead of a `whyChain`: `{ "kind": "inherited-debt", "source", "decision" }` on a file carve-out, `{ "kind": "existing-authorisation", "source" }` on an authorised location. `source` names the old record entry as `<directory>/cd-<id>.json#<index>`: `.constitution-carve-outs` for inherited debt, `.constitution-authorised-locations` for an existing authorisation, the old file for the record's discipline, and the entry's position in its array. Such an entry is imported, and is accepted only while the `--base-revision` already holds it unchanged, or, when the base holds no record for that kind, clause and file, while the `source` entry at that revision lists the file in its `files`. A new or edited entry without a `whyChain` is refused as `import-unverified`, and a run with imported entries and no `--base-revision` is `import-unmeasured`. The report names each imported entry it exempts by.
- A clause whose `discipline.json` declares `"exceptions": "refused"` cannot be exempted. No shipped discipline declares it, so every shipped clause can be.
- Files are exact repository paths, never globs.
- An entry that exempts nothing is stale, a file both authorised and carved for one clause is doubly held, and an entry that cannot be parsed is invalid. Each fails the run.

## Installing

Fetch these paths from a pinned commit of this repository into one install directory, keeping their layout:

- always: `README.md`, `core/` and `docs/why-chain-contract.md`
- into the install root: `install/package.json` and `install/package-lock.json`, each placed at the top of the install directory under its own file name
- for each selected clause in the shared rule set: `rules/<DisciplineId>/`, `mechanisms/<MechanismId>/runner/` and `mechanisms/<MechanismId>/<DisciplineId>/`
- for each selected clause in the repository's own rule set: `mechanisms/<MechanismId>/runner/` only, since the discipline and its piece live in that rule set
- to apply judgement rules in review: `rules/<DisciplineId>/` for each adopted judgement rule, and `methods/`; the check itself never reads them

`install/package.json` is the install manifest, generated from this package's development manifest by `bun run install-manifest`: it carries `"type": "module"`, core's own `dependencies` and the toolchain as `peerDependencies`, and no scripts or development dependencies. Every runtime file is an ES module, and Node takes a file's module type from the nearest `package.json` above it; without this one, that is the consumer's own, and under `"type": "commonjs"` the check crashes.

`install/package-lock.json` locks core's own packages and nothing else: `zod`, `jsonc-parser`, `@eslint/plugin-kit` and the five packages they need, eight in all. Install them inside the install directory with `npm ci --ignore-scripts`. Every toolchain peer is declared optional, so npm never installs a copy of the toolchain there; the toolchain comes from the repository being checked; see [Runtime](#runtime).

Leave out test files (`*.test.ts`), `tests/` folders and `test-fixtures/` folders. The install must not sit under a `node_modules` path, because Node does not strip types there. Nothing core reads or writes is under a harness directory.

`core/` is fetched whole, so it also carries three modules used only by core's own tests of piece imports and install naming: `core/check/piece-import-rules.ts`, `core/check/install-naming.ts` and `core/mechanism-port/piece-type-packages-schema.ts`; nothing loads them at runtime.

With the ESLint mechanism selected, the install must sit at the same path relative to the repository root on every teammate's machine and every CI runner, for example a fixed `tools/discipline-core/` inside the repository. The projection `disciplines.eslint.mjs` embeds the relative path from the repository root to each piece's plugin module, and core compares the committed file byte for byte with what `project-command` would write now. An install at a different relative path makes the check report `eslint out-of-date`, and the team's own ESLint run may fail to resolve the plugin import.

Core ships no helper that derives this list from `disciplines.json`; whether it should is an open design decision. For now the list is applied by hand or by the adopter's own script.

## Runtime

- Windows, Linux, macOS or WSL. Core keeps absolute paths in the platform's own form and repository paths in POSIX form, as git reports them.
- Node 22.18.0 or later, which runs `.ts` source by stripping types (`engines.node` in `package.json`). The team's own ESLint run needs it too, since the projection imports each piece's `.ts` plugin module.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- Core's own packages, `zod`, `jsonc-parser` and `@eslint/plugin-kit`, exact-pinned in `dependencies`, locked by `install/package-lock.json` and installed inside the install directory. They are implementation details: nothing of theirs crosses into the repository's code or configuration.
- The repository's own toolchain, declared as optional `peerDependencies`: `typescript` `>=4.8.4 <7.0.0` for the audit mechanism, and for the ESLint mechanism `eslint` `^9.12.0 || ^10.0.0`, `@typescript-eslint/parser` `^8.56.0` and `@typescript-eslint/eslint-plugin` `^8.56.0`. Each floor is the oldest release core is tested on: TypeScript 4.8 is the oldest whose syntax API the audit uses (`getModifiers`), ESLint 9.12.0 the first 9.x that can look up the configuration nearest each file, and typescript-eslint 8.56.0 the first whose peer range accepts ESLint 10. TypeScript stops below 7 because TypeScript 7's compiler API is a different one. Yarn Plug'n'Play is not supported.

Core loads the toolchain by Node's own resolution, upward from the install directory, which is the same resolution the pieces' plugin modules get when the team's ESLint loads the projection. Core's query of the team's configuration, its governance run and the pieces therefore all use one copy, the repository's. Keep the toolchain resolvable from the repository root: declare it in the root `package.json` (in a pnpm workspace, `pnpm add -Dw`). A package may install a different ESLint for its own lint script; core's verdict still comes from the root's, its governance behaviour is the same on either supported line, and the pieces that wrap native rules wrap the root's copies there too. Core's tests run the governance path and every piece's shared cases on four ESLint lines, 9.12.0 and 10.0.0 with typescript-eslint 8.56.0 and 9.39.5 and 10.11.0 with 8.71.2, and the audit pieces' shared cases on TypeScript 4.8.4 and 6.0.3; the in-process consumer fixtures run on ESLint 10.11.0, and `install-proof` runs real consumers on each floor.

A peer that is missing, cannot load, or is outside its range stops the mechanism before any piece loads, with one line such as `load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.12.0 || ^10.0.0: add a supported version to the devDependencies of the repository root`. A peer that resolves from inside the install, such as an `eslint` left in `tools/discipline-core/node_modules` by an older install, stops it as `toolchain-shadowed`, naming where it resolved and the folder to delete before running `npm ci` again.

A repository can hold one `eslint.config.*` at its root or one per package. Core resolves the team's configuration the way the team's own ESLint run does. ESLint 10, and ESLint 9 started with `--flag v10_config_lookup_from_file` (or `unstable_config_lookup_from_file`), use the `eslint.config.*` nearest each checked file. Plain ESLint 9 uses only the one in the directory it runs from, so for a repository whose `eslint` resolves to 9.x at `node_modules/eslint` and whose lint scripts carry no such flag, core reads the root `eslint.config.*` for every file, and fails the run as `team-config-unloadable` if there is none. When core cannot read an installed `eslint` at the repository root it assumes the nearest-to-file lookup. Each config that applies to a file must spread the projection. Detection cannot see how a task runner starts ESLint, so `disciplines.json` can state the lookup: `"eslintConfigLookup": "nearest-to-file"` or `"repository-root"`, which overrides detection. Both lookups are tested against monorepo fixtures with a config per package.

## Known limits

The namespace and package names are provisional until the tool is named: the mechanism id `audit`, the ESLint plugin namespace `discipline`, and the folder name `discipline-core` may change before a first named release.

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
- Detection reads an ESLint 9 run started from inside a package, or given the lookup flag through the environment or a task runner, as a root-only run; set `eslintConfigLookup` in `disciplines.json` for those repositories.
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
| `install-manifest` | `node scripts/write-install-manifest.ts`, then `npm install --package-lock-only` in `install/`: regenerates `install/package.json` from `package.json` and `install/package-lock.json` from it. Run it after changing `dependencies` or the peers; a test fails while they are out of step |
| `install-proof` | `node scripts/install-proof.ts`: reads the install path list from § Installing in this README and builds CommonJS consumers in an OS temporary directory outside the working tree. It installs core's own packages once with `npm ci` from `install/package-lock.json`, and each toolchain once, at the peers' floors, in a folder the consumers sharing it sit inside: TypeScript 4.8.4 alone for the audit consumers and the consumer without `eslint`, and ESLint 9.12.0 or 10.0.0 with typescript-eslint 8.56.0 and TypeScript 4.8.4 for the two ESLint consumers; four installs in all. It copies the listed paths and core's installed packages into each consumer and runs both commands, expecting a fail on a class, a pass once it is removed, a crash when the installed `package.json` is missing, and `toolchain-unavailable` for an ESLint consumer without `eslint`; the temporary directory is removed afterwards |
