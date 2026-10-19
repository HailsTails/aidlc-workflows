# CD-47: Tests are hermetic — no real side effects on anything real

## Rule

A test may not touch its environment or cause any real side effect on anything real. "Anything real" is everything the test did not itself create and does not itself dispose: the developer's repository, their user configuration and home directory, any network or live service, shared filesystem paths, the system clock, and the ambient process environment.

A test fakes the real subsystem. Spawning it is permitted in exactly one closed case: the subsystem's own observable behaviour is the assertion's subject and no fake can stand in for it. Setup, realism and convenience never qualify; state which assertion cannot be written against a fake, and if that sentence cannot be written, the test does not qualify. A qualifying test brings its own instance in a location it created and removes it afterwards; it never borrows the machine's.

Real git is the mechanically checked class: a test that spawns a real `git` subprocess passes an explicit hermetic environment at that call site, and never inherits the ambient one.

The sections below describe what the audit check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-47#hermetic-git-spawns` | audit | a git spawn in a test without a hermetic `env` |

## What the check flags
- Test files: `*.test.ts`, `*.test.tsx`, `*.test.mjs`, `*.test.js`, `*.spec.ts`, `*.spec.mjs`. Generated folders (`node_modules`, `dist`, `build`, `coverage`, `.git`, root `vendor`) are skipped; any other folder can be left out with `exclude` in disciplines.json.
- A line calling `spawnSync`, `spawn`, `execFileSync`, `execFile`, `execSync`, `exec`, `execa` or `execaSync` with `"git"` (or `'git'`, or a template literal) as the first argument.
- Allowed when, within that line and the next seven, an `env:` names `hermeticGitEnvironment`, `withoutInheritedGitBindings` or `environment`, and no nearby `env:` uses `process.env`. The helper is yours to provide.
- Not detected: a command string such as `execSync("git status")`, a split call, or a non-literal command. Whether the spawn is warranted at all is left to review.

## Example violation
```ts
spawnSync("git", ["init"], { cwd: directory });
```

## How to fix
```ts
spawnSync("git", ["init"], { cwd: directory, env: hermeticGitEnvironment() });
```
Build the environment without inherited git variables or the user's configuration, and run in a temporary directory.

## Exceptions
Record exemptions only in `discipline-exceptions.json` at the repository root; core reads no other allowance file. Use `authorised-location` when a test file legitimately builds its environment another way. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-47#hermetic-git-spawns", "file": "test/git-fixture.test.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
