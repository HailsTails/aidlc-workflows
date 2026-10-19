# Adding a discipline or a mechanism

Core names no discipline and no mechanism, so adding either one is a matter of adding files in the right places. This guide lists those files, the import boundaries they must keep, and, for a mechanism with its own exception formats, how each format maps to an exception kind.

Terms used below:

- A **discipline** is a coding rule with an id such as `CD-14`, made of one or more **clauses**.
- A **mechanism** is a tool that checks clauses, such as the TypeScript `audit` or `eslint`. Each mechanism has one **runner**.
- A **piece** is one discipline's code for one mechanism, written in that mechanism's own extension format.
- A **rule set** is a directory holding `rules/` and `mechanisms/` folders. The rule set shipped with core is `shared`; a repository can add its own and name them in `disciplines.json`.
- A **native channel** is a way the tool itself lets a team exempt or weaken a rule, outside core's exception records.

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

The cases are shared by every mechanism the clause lists. A mechanism conforms for a clause when, run over each case's source, it flags exactly the expected lines. That is how two mechanisms are held to the same verdict: CD-14's `class-syntax` cases are run through both the walker and the ESLint runner.

### 3. A piece per mechanism

For each mechanism in a clause's `mechanisms` list, add a piece folder `mechanisms/<MechanismId>/<DisciplineId>/` in the same rule set, holding `piece.json` and the piece's source.

```json
{
  "version": 1,
  "discipline": "PD-1",
  "mechanism": "audit",
  "clauses": [{ "clause": "no-tmp-files", "settings": { "module": "no-tmp-files.ts" } }]
}
```

`discipline` and `mechanism` must match the folder names, every `clause` must exist in the discipline, and no clause may appear twice. Core reads only this envelope. `settings` belongs to the runner, which parses it with its own schema:

- **audit:** `{ "module": "<file>.ts" }`, a path inside the piece folder. The module exports `check`, typed with `import type { WalkerPiece }` from `mechanisms/audit/runner/walker-piece.ts`. See `mechanisms/audit/runner/README.md`.
- **eslint:** `{ "pluginNamespace", "pluginModule", "rule" }`. `pluginModule` is a `.ts` path inside the piece folder whose default export is an ESLint plugin; `rule` must be a key of its `rules`. The rule id is `<pluginNamespace>/<rule>`. The namespace `discipline-core` is reserved, and two selected clauses may not share a rule id, or a namespace with different plugin modules. CD-14's piece is `mechanisms/eslint/CD-14/piece.json`, pointing at the rule `no-class-authoring` in `cd14/cd14.eslint-plugin.ts` under the namespace `discipline`.

A runner reports a bad `settings` value, a module that fails to load or does not match its schema, or a missing rule as `piece-invalid`.

### 4. Tests

Give each piece source file a co-located `.test.ts`. A piece's test runs the clause's shared cases through its runner and checks the flagged lines:

- an audit piece calls `conform` on an audit runner (`mechanisms/audit/CD-14/class-syntax.test.ts` builds one with `createWalkerRunner` and the real TypeScript parse port);
- an ESLint piece calls the ESLint port's `lintSourceCases` with its plugin (`mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.test.ts`).

A path-only audit piece reads no source, so its test can prepare `check` and call `prepareFile` directly on each path, as the probe's does. The runner's own suite runs core's `checkConformance` over every shared piece it serves (see "Adding a mechanism", step 4). FR-8's import checks (below) cover the new files with no change.

### Worked example: the probe discipline

`tests/probe-rule-set/` is a test-only rule set, named `probe`, holding one discipline written exactly as a team would write its own. It was added beside CD-14 with no change to core or to the audit runner.

- `tests/probe-rule-set/rules/PD-1/discipline.json` declares one mechanical clause, `no-tmp-files`: mechanisms `["audit"]`, anchor `{ "kind": "file" }`, one flag case (`src/scratch.tmp.ts`, line 1) and one allow case (`src/kept.ts`, no lines).
- `tests/probe-rule-set/mechanisms/audit/PD-1/piece.json` maps that clause to the module `no-tmp-files.ts`.
- `tests/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts` exports `check`, an audit piece that completes each file from its path alone: a hit at line 1 for a path ending `.tmp.ts`, none otherwise. It reads no file, so the walker never parses on its behalf.
- `no-tmp-files.test.ts` tests `check` directly; the probe has no conformance test of its own.
- The piece imports only a type, `WalkerPiece`, from the audit runner, as a path relative to its own file. Type imports are erased when Node runs the source, so the path matters only to typechecking.

A repository selects it by naming the rule set and the clause:

```json
{
  "version": 1,
  "ruleSets": { "probe": "probe" },
  "clauses": { "probe/PD-1#no-tmp-files": "audit", "CD-14#class-syntax": "audit" }
}
```

`tests/probe-check.integration.test.ts` runs that selection: the probe flags `src/scratch.tmp.ts`, CD-14 flags the class in `src/kept.ts`, and the audit runner parses each file once even though two disciplines are selected.

## Adding a mechanism

### 1. The runner

Create `mechanisms/<MechanismId>/runner/runner.ts`. The id is lower-case words joined by hyphens. The module has one named export, `runner`, built by a factory in its own file so the runner's tests can call the factory with fakes. The ESLint runner's `runner.ts`:

```ts
export const runner = createEslintRunner({
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  path: createDefaultPathPort({}),
  eslint: createDefaultEslintPort({}),
});
```

Core loads `runner.ts` once per check and parses the export with its own schema (`core/mechanism-port/runner-module-schema.ts`). An unknown exception path, a missing member or a member that is not a function is the load failure `runner-invalid`. Core also parses everything a runner returns; a value outside its schema, a hit for a clause or file it was not asked about, or a call that throws or rejects is `runner-invalid-output`, and the check exits `2`. A runner reports its own failures as a `RunnerFailure` (`core/mechanism-port/runner-failure.ts`): `piece-invalid`, `tool-failed`, `file-unreadable`, `file-unparseable`, `plugin-conflict`, `team-config-unloadable` or `runner-invalid-output`.

Use core's ports (`core/platform-ports/`) for files, module loading and paths, and wrap the tool itself in one factory file that is the only place the tool's package is imported. The audit mechanism's is `typescript-parse.ts`; the ESLint runner's is `eslint-instance.ts` (ESLint and `@typescript-eslint/parser`), with `inline-config-parser.ts` the only importer of `@eslint/plugin-kit`.

### 2. Choose an exception path

A runner declares `exceptionPath`, which tells core how the tool's own exception formats are handled.

- **Standalone** (`"standalone"`): the tool has no exception format of its own, or none the repository can write to. The runner implements `run`, which returns raw hits for the selected clauses with no exception applied, and `conform`, which runs a clause over its shared cases without reading any repository file. Core applies `discipline-exceptions.json` itself. The audit mechanism is standalone. The author's contract is `StandaloneRunner` in `core/mechanism-port/runner-module-schema.ts`.
- **Embedded** (`"embedded"`): the tool has its own ignore, override, suppression or inline formats, which the team's own run of the tool honours. The runner reports every native channel that touches a selected clause, and writes a projection so the team's run honours the recorded exceptions. ESLint is embedded. The author's contract is `EmbeddedRunner` in `core/mechanism-port/embedded-runner-module-schema.ts`; see "Embedded mechanisms" below.

Core knows only these two paths. A mechanism that fits neither would need a change to core.

### 3. The runner's other files

- `mechanisms/<MechanismId>/runner/piece-type-packages.json`: a JSON array of the packages a piece may import types from. The audit mechanism's is `["typescript"]` and the ESLint runner's is `["eslint"]`. It is not the runtime list.
- `mechanisms/<MechanismId>/runner/README.md`: the runner's runtime requirements, its piece contract and its piece settings. See `mechanisms/audit/runner/README.md` and `mechanisms/eslint/runner/README.md`.
- A co-located `.test.ts` for every source file.

### 4. Conformance

Each runner's suite runs core's `checkConformance` (`core/conformance/conformance.ts`) over the real runner as core loads it, for every shared clause its pieces serve. It calls the runner's `conform` and compares the flagged lines with each case's expected lines; the runner conforms for a clause when the result is ok and lists no failures. The audit mechanism's is `mechanisms/audit/runner/walker-conformance.test.ts`; the ESLint runner's is in `mechanisms/eslint/runner/native-exceptions.integration.test.ts`. Conformance runs the real tool in memory, because the tool's verdict is what is being checked.

### 5. Selecting it

To let a clause use the new mechanism, add the mechanism id to that clause's `mechanisms` list and add a piece for it (see "Adding a discipline", step 3). Until a clause lists it, a repository cannot select it.

## Import boundaries (FR-8)

These hold for every discipline and mechanism. Tests under `core/check/` check them over every file in the install and the probe rule set, so a new file is covered with no change, with one exception: a new mechanism's wrapping file, the one runner file allowed to import its tool, must be added by name to the lists in `core/check/vendor-imports.test.ts`, which name each mechanism's wrapping files and vendors.

- **Core names no discipline and no mechanism.** No file under `core/` may contain a discipline id or mechanism id found in the install, or import anything under `mechanisms/` or `rules/` (`core/check/core-names-no-mechanism.test.ts`). Core reaches a runner only by loading its `runner.ts` at run time.
- **A runner names no discipline.** No file in a `mechanisms/<MechanismId>/runner/` folder may contain a discipline id.
- **A piece reaches only its own mechanism's runner, core, and its own discipline's files** (`core/check/piece-imports.test.ts`). A relative import from a piece in `mechanisms/<MechanismId>/<DisciplineId>/` must resolve inside exactly one of: that piece folder; the same rule set's `rules/<DisciplineId>/`; the install's `mechanisms/<MechanismId>/runner/`; or the install's `core/`. Another mechanism's piece for the same discipline is out of reach.
- **A piece imports a package only as a type**, and only a package its runner lists in `piece-type-packages.json`. A value import of a package, including a `node:` module, and any dynamic import are refused. An audit piece gets TypeScript's runtime API as an argument, so it never imports `typescript` as a value; an ESLint rule gets everything it needs from ESLint's rule context.

## Embedded mechanisms

An embedded runner has the same `run` and `conform` as a standalone one, plus:

- `projectedKinds`: the native exception kinds its own projection writes. Only these kinds can be matched by a record.
- `run` also receives the repository's exception records for that mechanism, so it can regenerate the projection and compare it. It returns hits, the native exceptions it found, and the projection's state: `current`, `out-of-date`, `missing` or `not-included`. A projection that is missing or not included means the mechanism did not run: core lists `mechanism-not-run` and the check fails. An out-of-date one is a projection problem and also fails.
- `project`: writes the projection file and returns its path with `written` or `unchanged`. `project-command` calls it.

Core passes every record for the mechanism to both calls, forfeited or not, and never passes the touched set. A forfeited file carve-out therefore stays in the projection and still matches its native exception; core's check reports it as `forfeited` and fails the run. Keep it that way: a runner must not compute forfeiture or read the touched set itself, so that whether a forfeited carve-out stays pushed down remains core's decision. No test checks this; it is a rule for review.

### Native channels

Writing an embedded mechanism means listing every native channel the tool has and mapping each one to an exception kind core understands (`nativeExceptionSchema` in `core/mechanism-port/embedded-run-report-schema.ts`). A native exception is accepted only when its kind is in the runner's `projectedKinds` and a record in `discipline-exceptions.json` covers it; every other native exception is reported as unrecorded and fails the run, whether or not it currently hides a finding.

The ESLint runner's map. "Checked file" means a tracked `.ts`, `.tsx`, `.mts` or `.cts` file; "selected rule" means the rule id of a selected clause's ESLint piece.

| ESLint native channel | Exception kind | Can a record cover it? |
| --- | --- | --- |
| a checked file the team's configuration ignores (for example a global `ignores` block); reported for every selected clause | `ignore` | no |
| a checked file on which the team's resolved configuration leaves a selected rule below `"error"` (`"warn"`, `"off"` or not set) | `config-override` | yes |
| an entry for a selected rule in any tracked file named `eslint-suppressions.json`, or in a file named by `--suppressions-location` in a tracked `package.json` script | `suppression-entry` | no |
| an `eslint-disable`, `eslint-disable-line` or `eslint-disable-next-line` comment naming a selected rule, or naming no rule | `inline-disable` | no |
| an `/* eslint ... */` comment configuring a selected rule, or one that cannot be parsed | `inline-rule-config` | no |
| an option in an ESLint invocation in a tracked `package.json` script that weakens or replaces a selected rule's configuration: `--rule` or `--suppress-rule` naming it, or `--suppress-all`, `--ignore-pattern`, `-c`/`--config`, `--no-config-lookup`, `--parser`, `--parser-options` or `--plugin` | `command-line-option` | no |

The ESLint runner declares `projectedKinds: ["config-override"]`. A record covers a `config-override` on its own file (authorised location or file carve-out) or on every file (clause-wide carve-out).

How the runner finds each channel (`mechanisms/eslint/runner/`):

- `ignore` and `config-override` come from a query instance of ESLint on the team's own configuration (`eslint-instance.ts`): `isPathIgnored` and `calculateConfigForFile` per checked file. A configuration that fails to load is `team-config-unloadable`; one that registers a different module under a selected piece's namespace is `plugin-conflict`.
- `inline-disable` and `inline-rule-config` come from a reserved rule, `<reservedNamespace>/inline-config` (currently `discipline-core/inline-config`), that runs in core's governance lint and reads each file's inline configuration comments with `@eslint/plugin-kit` (`inline-config-parser.ts`). `eslint-enable` and other directives such as `/* global */` are not reported.
- `suppression-entry` comes from `suppressions-scanner.ts`. Keys in a tracked `eslint-suppressions.json` are read relative to its folder; keys in a file named by `--suppressions-location` are read relative to the `package.json` that names it.
- `command-line-option` comes from `package-script-scanner.ts`, which parses every tracked `package.json` and splits each script into commands. A command is an ESLint invocation when a token is `eslint`, starts `eslint@`, or ends `/eslint` or `/eslint.js`. A script with an unterminated quote is `tool-failed`.

Hits come from a separate governance instance that uses only the runner's configuration: the selected rules and the inline-config rule at `"error"` on `**/*.{ts,tsx,mts,cts}`, parsed with `@typescript-eslint/parser`, with the team's configuration file, ignores, suppressions and inline configuration all off. No native channel can change core's findings.

Options passed outside a `package.json` script (a CI step, an editor setting, a wrapper script) are not found. They cannot change core's verdict, but core cannot check whether such a run honours the records.

### The ESLint projection

`projection.ts` writes `disciplines.eslint.mjs` at the repository root. It imports each piece's plugin module by a path relative to the repository root, then exports, in order: one block per plugin namespace enabling its selected rules at `"error"` on `**/*.{ts,tsx,mts,cts}`; one block per authorised location or file carve-out turning those rules `"off"` for that file (the path escaped as a glob); and one block per clause-wide carve-out turning them `"off"` everywhere. Block names start with `reservedNamespace` (currently `discipline-core/`). The output is sorted, so the same selection and records always produce the same text.

The team spreads its default export last in its flat config; the projection is the only supported way to adopt the rules. On each check the runner first compares the file with what it would write now (`missing`, or `out-of-date` if it differs). It then checks the projection's effect through the query instance, in two directions. Every selected rule must be set, at any severity, on at least one checked file that is not ignored, when there is one. Every record whose file is checked must leave its rules at severity `0` on that file, or on every checked file for a clause-wide carve-out. If either fails, the result is `not-included` with no hits. The second direction catches a team that enables a rule another way, for example through a piece's own fragment such as `mechanisms/eslint/CD-14/cd14.eslint.ts`, without importing the projection.

### Runtime

The ESLint mechanism needs the team's `eslint` 10.x, an ESLint-10-compatible `@typescript-eslint/parser`, and `@eslint/plugin-kit`, which it imports directly because a transitive copy does not resolve under strict package managers. This package pins `eslint` 10.11.0, `@typescript-eslint/parser` 8.71.2 and `@eslint/plugin-kit` 0.7.3, and its integration suite runs on those, against the consumer repositories in `mechanisms/eslint/runner/test-fixtures/`.
