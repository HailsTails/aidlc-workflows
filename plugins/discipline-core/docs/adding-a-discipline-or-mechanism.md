# Adding a discipline or a mechanism

Core names no discipline and no mechanism, so adding either one is a matter of adding files in the right places. This guide lists those files, the import boundaries they must keep, and, for a mechanism with its own exception formats, how each format maps to an exception kind.

Terms used below:

- A **discipline** is a coding rule with an id such as `CD-14`, made of one or more **clauses**.
- A **mechanism** is a tool that checks clauses, such as the TypeScript `walker`. Each mechanism has one **runner**.
- A **piece** is one discipline's code for one mechanism, written in that mechanism's own extension format.
- A **rule set** is a directory holding `rules/` and `mechanisms/` folders. The rule set shipped with core is `shared`; a repository can add its own and name them in `disciplines.json`.

## Adding a discipline

### 1. The discipline file

Create `rules/<DisciplineId>/discipline.json` in a rule set. The id is two to four capital letters, a hyphen and a number, with an optional lower-case letter (`CD-14`, `PD-1`, `CD-7a`), and must match the folder name.

```json
{
  "version": 1,
  "id": "PD-1",
  "clauses": [ ]
}
```

Each clause is either mechanical or judgement:

- A **mechanical** clause has `id`, `summary`, `mechanisms` (the mechanism ids allowed to check it), `anchor` and `cases`. `anchor` is `{ "kind": "keyword", "keyword": "<token>" }` when hits sit on a token in the source, or `{ "kind": "file" }` for a clause about a path, whose hits are at line 1, column 0.
- A **judgement** clause has `id`, `summary` and `"enforcedBy": "review"`. It records the requirement but cannot be selected; review enforces it.

Clause ids are lower-case words joined by hyphens, and are unique within the discipline.

### 2. The shared cases

A mechanical clause's `cases` hold `flag` and `allow` lists. Each case is `{ "name", "fileName", "source", "expectedLines" }`: a flag case lists the lines that must be flagged (at least one), and an allow case lists none. `fileName` is a repository path and may be a declaration file such as `x.d.ts`. There must be at least one of each.

The cases are shared by every mechanism the clause lists. A mechanism conforms for a clause when, run over each case's source, it flags exactly the expected lines. That is how two mechanisms are held to the same verdict.

### 3. A piece per mechanism

For each mechanism in a clause's `mechanisms` list, add a piece folder `mechanisms/<MechanismId>/<DisciplineId>/` in the same rule set, holding `piece.json` and the piece's source.

```json
{
  "version": 1,
  "discipline": "PD-1",
  "mechanism": "walker",
  "clauses": [{ "clause": "no-tmp-files", "settings": { "module": "no-tmp-files.ts" } }]
}
```

`discipline` and `mechanism` must match the folder names, every `clause` must exist in the discipline, and no clause may appear twice. Core reads only this envelope. `settings` belongs to the runner, which parses it with its own schema: the walker's settings are `{ "module": "<file>.ts" }`, a path inside the piece folder.

What the piece's source looks like is the mechanism's business; see the runner's README. A walker piece exports `check`, typed with `import type { TypeScriptWalkerCheck }` from the walker's `typescript-parse.ts` (see `mechanisms/walker/runner/README.md`).

### 4. Tests

Give each piece source file a co-located `.test.ts`, including a conformance test that runs the mechanism's runner over the clause's shared cases (see "Adding a mechanism", step 4). FR-8's checks (below) cover the new files with no change.

### Worked example: the probe discipline

`tests/probe-rule-set/` is a test-only rule set, named `probe`, holding one discipline written exactly as a team would write its own. It was added beside CD-14 with no change to core or to the walker runner.

- `tests/probe-rule-set/rules/PD-1/discipline.json` declares one mechanical clause, `no-tmp-files`: mechanisms `["walker"]`, anchor `{ "kind": "file" }`, one flag case (`src/scratch.tmp.ts`, line 1) and one allow case (`src/kept.ts`, no lines).
- `tests/probe-rule-set/mechanisms/walker/PD-1/piece.json` maps that clause to the module `no-tmp-files.ts`.
- `tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts` exports `check`, a walker path check that returns `"violates"` for a path ending `.tmp.ts` and `"conforms"` otherwise. It reads no file, so the walker offers it every path without parsing.
- The piece imports only a type, `WalkerCheck`, from the walker runner, as a path relative to its own file. Type imports are erased when Node runs the source, so the path matters only to typechecking.

A repository selects it by naming the rule set and the clause:

```json
{
  "version": 1,
  "ruleSets": { "probe": "probe" },
  "clauses": { "probe/PD-1#no-tmp-files": "walker", "CD-14#class-syntax": "walker" }
}
```

`tests/probe-check.integration.test.ts` runs that selection: the probe flags `src/scratch.tmp.ts`, CD-14 flags the class in `src/kept.ts`, and the walker parses each file once even though two disciplines are selected.

## Adding a mechanism

### 1. The runner

Create `mechanisms/<MechanismId>/runner/runner.ts`. The id is lower-case words joined by hyphens. The module has one named export, `runner`, built by a factory in its own file so the runner's tests can call the factory with fakes:

```ts
export const runner = createWalkerRunner({
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  path: createDefaultPathPort({}),
  parse: createDefaultParsePort({}),
});
```

Core loads `runner.ts` once per check and parses the export with its own schema (`core/mechanism-port/runner-module-schema.ts`). An unknown exception path, a missing member or a member that is not a function is the load failure `runner-invalid`. Core also parses everything a runner returns; a value outside its schema, a hit for a clause or file it was not asked about, or a call that throws or rejects is `runner-invalid-output`, and the check exits `2`.

Use core's ports (`core/platform-ports/`) for files, module loading and paths, and wrap the tool itself in one factory file that is the only place the tool's package is imported. The walker's is `typescript-parse.ts`.

### 2. Choose an exception path

A runner declares `exceptionPath`, which tells core how the tool's own exception formats are handled.

- **Standalone** (`"standalone"`): the tool has no exception format of its own, or none the repository can write to. The runner implements `run`, which returns raw hits for the selected clauses with no exception applied, and `conform`, which runs a clause over its shared cases without reading any repository file. Core applies `discipline-exceptions.json` itself. The walker is standalone. The author's contract is `StandaloneRunner` in `core/mechanism-port/runner-module-schema.ts`.
- **Embedded** (`"embedded"`): the tool has its own ignore, override, suppression or inline formats, which the team's own run of the tool honours. The runner must report every one of these that touches a selected clause, and write a projection so the team's run honours the recorded exceptions. This path lands in chunk 2; see "Embedded mechanisms" below.

Core knows only these two paths. A mechanism that fits neither would need a change to core.

### 3. The runner's other files

- `mechanisms/<MechanismId>/runner/piece-type-packages.json`: a JSON array of the packages a piece may import types from, for example `["typescript"]`. It is not the runtime list.
- `mechanisms/<MechanismId>/runner/README.md`: the runner's runtime requirements, its piece contract and its piece settings.
- A co-located `.test.ts` for every source file.

### 4. Conformance

The mechanism's tests run the real runner's `conform` over the shared cases of every clause its pieces serve, and check that it flags exactly each case's expected lines. `checkConformance` in `core/conformance/conformance.ts` does that comparison: a runner conforms for a clause when the result is ok and lists no failures. The walker's CD-14 conformance test is `mechanisms/walker/CD-14/class-syntax.test.ts`. Conformance runs the real tool in memory, because the tool's verdict is what is being checked.

### 5. Selecting it

To let a clause use the new mechanism, add the mechanism id to that clause's `mechanisms` list and add a piece for it (see "Adding a discipline", step 3). Until a clause lists it, a repository cannot select it.

## Import boundaries (FR-8)

These hold for every discipline and mechanism. Tests under `core/check/` check them over every file in the install and the probe rule set, so a new file is covered with no change.

- **Core names no discipline and no mechanism.** No file under `core/` may contain a discipline id or mechanism id found in the install, or import anything under `mechanisms/` or `rules/` (`core/check/core-names-no-mechanism.test.ts`). Core reaches a runner only by loading its `runner.ts` at run time.
- **A runner names no discipline.** No file in a `mechanisms/<MechanismId>/runner/` folder may contain a discipline id.
- **A piece reaches only its own mechanism's runner, core, and its own discipline's files** (`core/check/piece-imports.test.ts`). A relative import from a piece in `mechanisms/<MechanismId>/<DisciplineId>/` must resolve inside exactly one of: that piece folder; the same rule set's `rules/<DisciplineId>/`; the install's `mechanisms/<MechanismId>/runner/`; or the install's `core/`. Another mechanism's piece for the same discipline is out of reach.
- **A piece imports a package only as a type**, and only a package its runner lists in `piece-type-packages.json`. A value import of a package, including a `node:` module, and any dynamic import are refused. A walker piece gets TypeScript's runtime API as an argument, so it never imports `typescript` as a value.

## Embedded mechanisms (chunk 2)

This section describes the design for the ESLint mechanism, which lands in chunk 2. None of its files exist yet.

An embedded runner has the same `run` and `conform` as a standalone one, plus:

- `projectedKinds`: the native exception kinds its own projection writes. Only these kinds can be matched by a record.
- `run` also receives the repository's exception records for that mechanism, only so it can regenerate the projection and compare it. It returns hits, the native exceptions it found, and the projection's state: `current`, `out-of-date`, `missing` or `not-included`. A projection that is missing or not included means the mechanism did not run and the check fails; an out-of-date one is a projection problem and also fails.
- `project`: writes the projection file, run by `project-command`.

### Native channels

A **native channel** is a way the tool itself lets a team exempt or weaken a rule, outside core's records. (FR-8's "native stores" means the same thing.) Writing an embedded mechanism means listing every native channel the tool has and mapping each one to an exception kind core understands. A native exception is recorded only when its kind is in the runner's `projectedKinds` and a record in `discipline-exceptions.json` matches it; every other native exception is reported as unrecorded and fails the run, whether or not it currently hides a finding.

The ESLint runner's map:

| ESLint native channel | Exception kind | Can a record cover it? |
| --- | --- | --- |
| a global ignore pattern that matches a checked file | `ignore` | no |
| a flat-config block that leaves a selected rule below `"error"` on a checked file | `config-override` | yes |
| an entry for a selected rule in a tracked `eslint-suppressions.json`, or in a file named by `--suppressions-location` in a `package.json` script | `suppression-entry` | no |
| an `eslint-disable`, `eslint-disable-line` or `eslint-disable-next-line` comment naming a selected rule, or naming no rule | `inline-disable` | no |
| an `/* eslint ... */` comment configuring a selected rule | `inline-rule-config` | no |
| an option in a `package.json` ESLint script that weakens or replaces a selected rule's configuration (`--rule`, `--suppress-rule`, `--suppress-all`, `--ignore-pattern`, `-c`/`--config`, `--no-config-lookup`, `--parser`, `--parser-options`, `--plugin`) | `command-line-option` | no |

The ESLint runner declares `projectedKinds: ["config-override"]`: its projection, `disciplines.eslint.mjs` at the repository root, holds one block enabling each selected rule and one block per exception record turning the rule off for that record's file (or everywhere, for a clause-wide carve-out). The team spreads that file last in its flat config, and it is the only supported way to adopt the rules. Core's own ESLint run uses only the runner's configuration, with suppressions and inline configuration off, so no native channel can change core's verdict.

Options passed outside a `package.json` script (a CI step, an editor setting, a wrapper script) are not found. They cannot change core's verdict, but core cannot check whether such a run honours the records.

### Runtime

The ESLint mechanism needs the team's `eslint` 10.x, an ESLint-10-compatible `@typescript-eslint/parser`, and `@eslint/plugin-kit`. Its runner's README will list them.
