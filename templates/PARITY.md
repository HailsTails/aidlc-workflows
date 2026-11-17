# Build-side rebuild and output parity

This branch rebuilds the build side of AI-DLC by bounded context and proves that nothing it produces changes. It is measured against upstream `main` at `{{pin}}`.

## What changed

- `scripts/package.ts` is now a short entry point into `src/`, which holds one folder per bounded context: `workflow-definition`, `projection`, `packaging`, `installation`, `execution` and `cli`, plus `kernel` for shared values and the platform implementers. `src/README.md` describes the layout and its rules.
- Each harness's build-side code moved into `src/hosts/<harness>/`: the `harness/<harness>/manifest.ts` rows, the Codex, Copilot and OpenCode emitters, the onboarding fills and the Kiro IDE delegate shell deny.
- `scripts/package-sources.ts`, `scripts/manifest-types.ts`, `scripts/harness-bindings.ts`, `scripts/onboarding.ts` and `scripts/earlier-release-regions.ts` moved into `src/` with their owners.
- Tests that imported the moved modules import them from `src/`. `src/` has its own unit tests, which touch no real files or processes.
- `zod` is a direct dev dependency, used at the file and JSON edges in `src/`. `bun run typecheck` also checks `src/tsconfig.json`.
- The coverage check `bun tests/gen-coverage-registry.ts --check --base <commit>` runs `bun install --frozen-lockfile` in the base commit's `git archive` tree before building it, as CI does in the checkout and `scripts/copy-era-files.ts` does in its archived release. A base that already contains `src/` needs `zod` to build, so without it a change made on top of this one fails the check with 45 `Cannot find package 'zod'` refusals.
- Nothing under `core/` or `plugins/` changes, and no shipped harness file changes: `hooks/`, `skills/`, `agents/`, `settings/`, `steering/`, `command/` and `plugin/` under `harness/<harness>/` are as they are on `{{pin}}`.

## How parity is proved

Two sets of goldens, both recorded on an unmodified `{{pin}}` checkout with the code in `scripts/parity/`:

- `tests/golden/<group>.json` holds the sha256 of every file under `dist/` and `dist-release/`, grouped by harness, with the plugin marketplace files under `plugin-marketplaces`. That is {{golden-file-count}} files in 8 groups.
- `tests/golden/install/<harness>.json` holds an install lifecycle for each of the 7 harnesses, run through the copy-channel CLI in a throwaway project: a fresh install, a refresh, a local edit the installer refuses, a forced refresh, and an upgrade over the previous release ({{previous-release}}). Each step records its exit code and the files it added, changed or removed.

Check this branch:

```sh
bun install
bun scripts/package.ts
bun scripts/parity/dist-goldens.ts --check
```

The install check also needs a dist built from the previous release, {{previous-release}}:

```sh
git worktree add ../aidlc-previous-release v{{previous-release}}
bun install --cwd ../aidlc-previous-release
bun ../aidlc-previous-release/scripts/package.ts
bun scripts/parity/install-lifecycle.ts --check --previous ../aidlc-previous-release/dist
```

Each check prints a one-line summary and exits non-zero, naming every file that differs. `--record` writes the goldens instead. To reproduce them, copy `scripts/parity/` into a `{{pin}}` checkout, build it, run `--record`, and compare the files with the ones here: they are byte-identical.

`scripts/parity/` is self-contained: it imports only Node and Bun built-ins and `zod`. `bun test ./scripts/parity` runs its unit tests.

{{optional-patch-notes}}

`bun test ./src` runs the unit tests of the new contexts.

## Open items

- Nothing in CI builds the previous-release dist yet, so the install check runs by hand.
- The upstream test runner's tiers and the CI workflows do not run `bun test ./src` yet.
- The install goldens record {{release}} over {{previous-release}}. The next upstream release needs them re-recorded from that release's commit.
- The rebuild has two phases. Phase 1 is this branch: the build side runs through `src/`, and every shipped byte stays as it is. Phase 2 moves the runtime owners out of `core/tools/` into `src/`, so they ship in the runtime bundle. That is runtime code, so it is a separate change, and it is what retires every bridge below.

## Upstream test cases re-expressed for the new owners

Every test file `{{pin}}` has is on this branch, and none has fewer cases. The `upstream-shape-tooling` branch counts them with `bun src/test-case-counts.ts`. Where a case tested a file that moved into `src/`, it runs here in upstream's runner against the new owner. `src/`'s own unit tests do not count toward this, because upstream's runner does not run them.

- `tests/unit/t-package-sources.test.ts`: every case in the `{{pin}}` file tested `scripts/package-sources.ts`, which moved to `src/packaging/adapters/packaged-sources-file.ts`. They run against the moved owner with upstream's assertions.
  - The fingerprint input list replaces `harness/claude/manifest.ts` with a harness file and `src/hosts/claude/host-data.ts`, the manifest's successor.
  - The ignore case also checks a `src/` test file.
  - A record whose sources changed during the build answers `inputs-changed`, where upstream returned `false`.
  - The stale-dist coverage case runs as the two copied-coverage cases below.
- `tests/integration/t145-packaging-parity.test.ts`: three cases built a renamed or synthetic harness by editing `harness/<name>/manifest.ts`. A host now declares every path in its own `src/hosts/<name>/` files, so the fixture renames the host's directory throughout that folder.
  - "a host whose directory is renamed passes the new harnessDir to its tools" runs in place of "a synthetic harness uses the default orchestrator path and passes harnessDir to tools". Two parts of the original cannot apply:
    - **The synthetic name.** The model policy in `core/tools/aidlc-model-policy.ts` is keyed by host name. Upstream's synthetic `foo` built only because its copied manifest kept Claude's `tierFlavor`, so a new name needs a model-policy row in `core/`, which this branch does not change. The renamed host keeps the name `claude`.
    - **The default orchestrator path.** The path is no longer an optional field. Each host's comes from its skills root, which `t303` checks.
  - "a codex host honors a renamed harnessDir" makes upstream's assertions on the hooks, rules, trust seed and runner. For the same model-policy reason, the hook commands name the adapter `codex`, not `foo`.
  - "write mode derives the graph when a harnessDir is renamed" makes upstream's assertions.
  - The nondeterministic-emitter case runs as "--check reports the path built nondeterministically", on a host settings renderer.
- `tests/unit/t285-knowledge-skill.test.ts`: "the codex/copilot hardcoded skill array names the skill (the N-of-N trap)" read the skill arrays in the Codex and Copilot `emit.ts`. Both are retired, and every host now renders session skills from one list, `SESSION_SKILL_NAMES` in `src/projection/domain/neutral-surface.ts`. The case runs for each of the seven hosts: the host's skill renderer renders session skills, and the list names `aidlc-knowledge`.
- `tests/unit/t303-packager-orchestrator-skill-path.test.ts`: "package.ts resolves the optional manifest field with the in-tree default" read `scripts/package.ts`. It runs as "each host's skill renderer places the orchestrator skill in-tree at its declared path".
  - The case checks that each host's renderer writes `skills/aidlc/SKILL.md` at the path the test matrix declares, through `projectPath`.
  - Neither the renderers nor `scripts/package.ts` joins a project root with `.agents` or `.github` skills.
  - The in-tree default for an omitted field cannot apply, because the field is no longer optional.

## Foundation tests not on this branch

- The 62 test files of the lint and process layer that this branch leaves out: 61 under `lint/` (14 lint rules, 47 gate) and `eslint.config.test.ts`. Four gate test files moved with the parity code into `scripts/parity/`.
- `tests/unit/t-e2e-temporary-root.test.ts`: "an explicit root contains the descendant fixture and its cache" and "an unavailable explicit root refuses instead of choosing an OS fallback". They test a runner change to `tests/lib/e2e-workers.ts`, which this branch keeps as it is on `{{pin}}`.
- `tests/unit/t-runner-production-guards.test.ts`: "an explicit temp boundary keeps the isolated fixture workspace Git-free", for the same runner change.
- `tests/unit/t-aidlc-lib-only-shrinks.test.ts`: "no monolith gains a top-level declaration or a line over its record", which used the lint layer's monolith records. The `{{pin}}` case "aidlc-lib.ts declares no name that is not on its list" runs instead.
- `tests/integration/t-e2e-isolated-runner.test.ts`: "copied coverage refuses stale sources without changing its registry" and "copied coverage prints a source refusal before changing its registry" moved to `tests/unit/t-package-sources.test.ts` with the same assertions, on a fixture of their own. They test `tests/gen-coverage-registry.ts` against the moved `src/packaging/adapters/packaged-sources-file.ts`.

## Branch history

This branch is one commit on top of the rebuild's own history. The same tree as a single commit on `{{pin}}`, for a pull request against upstream, comes from the `upstream-shape-tooling` branch of this fork:

```sh
bun src/regenerate.ts --repository <checkout> --pin {{pin}} --parent {{pin}} --branch upstream-shape-on-pin
```

The regenerated commit is authored and committed by `HailsTails <9475175+HailsTails@users.noreply.github.com>`, set in the tooling and never read from git config, with no `Co-Authored-By` trailer, so it needs no re-authoring before it goes upstream.

## Bridge map

Where the rebuilt build side still couples to the runtime, and what retires each coupling. The same data is in `src/bridge-map.json`. The map is descriptive: nothing on this branch enforces the context arrows, the bridges or `src/glossary.json`.

{{bridge-map}}
