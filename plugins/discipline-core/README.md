# Discipline core

Discipline core checks a repository against the coding disciplines it has chosen to adopt. It is a tool, not a framework: it reads what the repository selected, hands each selected clause to the mechanism that checks it, applies the repository's recorded exceptions, and prints one verdict. Core itself enforces nothing and names no discipline and no mechanism. A discipline (for example CD-14, no authored classes) is data under `rules/`, and a mechanism (for example the TypeScript walker) is a runner under `mechanisms/`; core reaches both only through files and one module contract.

Adding a discipline or a mechanism is covered in [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

## Commands

Both commands run TypeScript source directly with Node; there is no build step.

```text
node <install>/core/check/check-command.ts --repo <dir> [--base-revision <rev>]
node <install>/core/check/project-command.ts --repo <dir>
```

`check-command` loads the repository's selection, exceptions, rule sets and pieces; works out which files changed since `--base-revision`; runs each selected mechanism once over the repository's tracked TypeScript files; applies the exceptions; and prints a plain-text report ending in `verdict: pass` or `verdict: fail`.

| Exit | `check-command` | `project-command` |
| --- | --- | --- |
| `0` | the verdict is `pass` | every projection was written or already current |
| `1` | the verdict is `fail` | not used |
| `2` | an input could not be loaded, or a mechanism failed or returned invalid output | any failure |

A load failure prints one line, `load failure: <kind> <fields>`.

The report lists findings, exempted findings, uncovered clauses, stale, forfeited, unrecorded and doubly-held exceptions, invalid exception records, unmeasured checks and projection problems, each with its count. The verdict is `pass` only when every list except exempted findings is empty.

`project-command` writes the native configuration an embedded mechanism needs so the team's own tool honours the recorded exceptions, and prints `<path> <effect>` per file (`written` or `unchanged`). The walker is standalone and writes nothing, so with only the walker installed the command prints nothing and exits `0`.

Without `--base-revision`, core cannot tell which files were touched, so a file carve-out cannot be forfeited; if any file carve-out exists the report lists `forfeiture-unmeasured` and the run fails.

## disciplines.json

At the repository root. It selects clauses and the mechanism that checks each one.

```json
{
  "version": 1,
  "ruleSets": { "team": "tools/disciplines" },
  "clauses": {
    "CD-14#class-syntax": "walker",
    "team/TD-1#some-clause": "walker"
  }
}
```

- `ruleSets` names the repository's own rule sets, each a directory relative to the repository root. The name `shared` is reserved for the rule set shipped with core.
- `clauses` maps a clause address to a mechanism id. An address is `[<ruleSet>/]<DisciplineId>#<clauseId>`; no prefix means the shared rule set.
- Selecting a clause adopts its discipline. Mechanical clauses of an adopted discipline that are not selected are reported as uncovered, and fail the run.
- A judgement clause cannot be selected; it is enforced by review.

## discipline-exceptions.json

At the repository root; absent means no exceptions. Each entry names a selected clause.

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

- `core/`
- for each selected clause in the shared rule set: `rules/<DisciplineId>/`, `mechanisms/<MechanismId>/runner/` and `mechanisms/<MechanismId>/<DisciplineId>/`
- for each selected clause in the repository's own rule set: `mechanisms/<MechanismId>/runner/` only, since the discipline and its piece live in that rule set

Leave out test files (`*.test.ts`) and `tests/` folders. The install must not sit under a `node_modules` path, because Node does not strip types there. Nothing core reads or writes is under a harness directory.

## Runtime

- Node 22.18.0 or later, which runs `.ts` source by stripping types.
- git 2.24 or later. Older git rejects `--end-of-options`, so the changed-file query fails and forfeiture is reported unmeasured.
- `zod`, for core.
- Each mechanism adds its own packages, listed in its runner's README. The walker needs `typescript`.

## Developing core

This directory builds and tests on its own, using only its own configuration: `package.json` declares the packages the code imports, `tsconfig.json` typechecks it under `strict`, `lint.biome.json` configures the linter, and `vitest.config.ts` runs its tests. Run a script from this directory, or from the repository root with `bun run --cwd plugins/discipline-core <script>`:

| Script | Runs |
| --- | --- |
| `typecheck` | `tsc` with `tsconfig.json` |
| `lint` | Biome with `lint.biome.json` |
| `test` | Vitest with `vitest.config.ts` |
| `check` | all three in that order |

`fork-wiring.test.ts` reads this repository's CI workflow and harness configuration, so it passes only inside this repository.
